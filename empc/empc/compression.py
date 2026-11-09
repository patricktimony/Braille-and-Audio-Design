"""Minimum-intelligence compression of discovered relationships.

For every pattern we fit a ladder of models of increasing cost and keep the
*cheapest* one whose validation performance is within one standard error of
the best (the "1-SE rule").  All models predict the follower signal from its
own recent history plus the leader signal; the score is the gain over the
self-history model.

  M1 single-lag linear        2 numbers describe the relationship
  M2 sparse lagged kernel     Lasso over a window of lags
  M3 dense lagged kernel      ridge over the same window
  M4 small MLP                (sklearn, 1 hidden layer of 16)
  M5 gradient-boosted trees   (sklearn HistGradientBoosting)

Description length (two-part MDL, Gaussian residuals):
  L = n/2 * log2(SSE/n) + k/2 * log2(n_fit)  bits,
so "bits saved per sample" = (L_self_history - L_model) / n.
"""
from __future__ import annotations

import time
import warnings
from dataclasses import dataclass, field

import numpy as np

from .discovery import SearchConfig, bits_saved, design, self_lags
from .store import FeatureStore


@dataclass
class LaggedModel:
    kind: str
    predictor: str
    response: str
    scale: float
    src_lags: list
    slags: list
    estimator: object = None
    coef: np.ndarray = None  # linear: [intercept, self..., src...]
    params: int = 0
    flops: int = 0
    fit_cpu_s: float = 0.0
    val: dict = field(default_factory=dict)
    self_coef: np.ndarray = None  # self-history-only baseline fitted on the same training rows

    def preds(self):
        return [(self.predictor, self.scale, L) for L in self.src_lags]

    def predict(self, S, X):
        if self.coef is not None:
            return self.coef[0] + np.column_stack([S, X]) @ self.coef[1:]
        return self.estimator.predict(np.column_stack([S, X]))

    def source_contribution(self, X):
        """Part of the prediction carried by the leader signal alone (linear models)."""
        if self.coef is not None:
            return X @ self.coef[1 + len(self.slags):]
        return None

    def equation(self, rate: float, max_terms: int = 4) -> str:
        sc = f", smoothed {self.scale:g} s" if self.scale else ""
        if self.coef is None:
            return (f"z[{self.response}](t) = f(own history at t-{self.slags[0] / rate:g}s.., "
                    f"z[{self.predictor}{sc}] at lags {self.src_lags[0] / rate:g}..{self.src_lags[-1] / rate:g} s); "
                    f"f = {self.kind} ({self.params} parameters)")
        b = self.coef[1 + len(self.slags):]
        idx = np.argsort(-np.abs(b))[:max_terms]
        terms = " ".join(f"{'+' if b[i] >= 0 else '-'} {abs(b[i]):.3f}*x(t-{self.src_lags[i] / rate:.1f}s)"
                         for i in sorted(idx, key=lambda i: self.src_lags[i]))
        more = f" (+{int((np.abs(b) > 1e-9).sum()) - len(idx)} smaller terms)" if (np.abs(b) > 1e-9).sum() > len(idx) else ""
        hist = " + ".join(f"{self.coef[1 + j]:.2f}*y(t-{L / rate:.1f}s)" for j, L in enumerate(self.slags))
        return f"y(t) = {hist} {terms}{more};  x = z[{self.predictor}{sc}], y = z[{self.response}]"


def _window(tau: int, rate: float, response: str) -> list[int]:
    half = int((2.0 if response.startswith("physio") else 1.0) * rate)
    return list(range(max(0, tau - half), tau + half + 1))


def fit_ladder(store: FeatureStore, predictor: str, response: str, scale: float, tau: int,
               cfg: SearchConfig, rng, kinds=("M1", "M2", "M3", "M4", "M5")) -> tuple[list[LaggedModel], dict]:
    from sklearn.ensemble import HistGradientBoostingRegressor
    from sklearn.linear_model import LassoCV, RidgeCV
    from sklearn.neural_network import MLPRegressor

    rate = store.rate
    sl = self_lags(response, cfg, rate)
    win = _window(tau, rate, response)
    out = []
    base = {}
    Sf, _, yf, _ = design(store, response, [], sl, scale, "fit", cfg.val_split)
    Sv, _, yv, segv = design(store, response, [], sl, scale, "val", cfg.val_split)
    if len(yf) < 50 or len(yv) < 30:
        return [], {}
    A = np.column_stack([np.ones(len(Sf)), Sf])
    bs, *_ = np.linalg.lstsq(A, yf, rcond=None)
    sse_self = float(np.sum((yv - (bs[0] + Sv @ bs[1:])) ** 2))
    sst = float(np.sum((yv - yv.mean()) ** 2)) or 1.0
    base = {"val_r2_self": 1 - sse_self / sst, "sse_self": sse_self, "n_val": len(yv), "n_fit": len(yf)}
    for kind in kinds:
        lags = [tau] if kind == "M1" else win if kind in ("M2", "M3") else win[::2]
        preds = [(predictor, scale, L) for L in lags]
        Sf, Xf, yf, _ = design(store, response, preds, sl, scale, "fit", cfg.val_split)
        Sv, Xv, yv, segv = design(store, response, preds, sl, scale, "val", cfg.val_split)
        m = LaggedModel(kind, predictor, response, scale, lags, sl, self_coef=bs)
        F = np.column_stack([Sf, Xf])
        t0 = time.process_time()
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            if kind == "M1":
                A = np.column_stack([np.ones(len(F)), F])
                m.coef, *_ = np.linalg.lstsq(A, yf, rcond=None)
                m.params = 1 + F.shape[1]
            elif kind == "M2":
                est = LassoCV(cv=3, alphas=20, max_iter=3000, random_state=0).fit(F, yf)
                m.coef = np.concatenate([[est.intercept_], est.coef_])
                m.params = 1 + int((np.abs(est.coef_) > 1e-9).sum())
            elif kind == "M3":
                est = RidgeCV(alphas=np.logspace(-2, 3, 12)).fit(F, yf)
                m.coef = np.concatenate([[est.intercept_], est.coef_])
                m.params = 1 + F.shape[1]
            elif kind == "M4":
                est = MLPRegressor(hidden_layer_sizes=(16,), max_iter=300, early_stopping=True,
                                   random_state=int(rng.integers(1 << 30))).fit(F, yf)
                m.estimator = est
                m.params = F.shape[1] * 16 + 16 + 16 + 1
            elif kind == "M5":
                est = HistGradientBoostingRegressor(max_iter=100, max_depth=3, learning_rate=0.1,
                                                    random_state=0).fit(F, yf)
                m.estimator = est
                n_nodes = sum(len(p[0].nodes) for p in est._predictors)
                m.params = 2 * n_nodes
        m.fit_cpu_s = time.process_time() - t0
        m.flops = 2 * m.params if kind in ("M1", "M2", "M3") else (2 * m.params if kind == "M4" else 100 * 3 + 100)
        pv = m.predict(Sv, Xv)
        sse = float(np.sum((yv - pv) ** 2))
        extra = m.params - (1 + len(sl))
        m.val = {"gain": (sse_self - sse) / sst, "bits": bits_saved(sse_self, sse, len(yv), extra, len(yf)),
                 "sse": sse, "resid_gain_rows": ((yv - (bs[0] + Sv @ bs[1:])) ** 2 - (yv - pv) ** 2) / sst * len(yv)}
        out.append(m)
    return out, base


def select_minimal(models: list[LaggedModel], rng, block: int = 50, n_boot: int = 200) -> tuple[LaggedModel, dict]:
    """1-SE rule on validation gain, with SE from a block bootstrap."""
    if not models:
        return None, {}
    best = max(models, key=lambda m: m.val["gain"])
    rows = best.val["resid_gain_rows"]
    n = rows.size
    nb = max(1, n // block)
    boots = []
    for _ in range(n_boot):
        starts = rng.integers(0, max(1, n - block), size=nb)
        idx = np.concatenate([np.arange(s, min(n, s + block)) for s in starts])
        boots.append(rows[idx].mean())
    se = float(np.std(boots))
    ok = [m for m in models if m.val["gain"] >= best.val["gain"] - se]
    chosen = min(ok, key=lambda m: (m.params, m.flops))
    return chosen, {"best_kind": best.kind, "best_gain": best.val["gain"], "se": se}
