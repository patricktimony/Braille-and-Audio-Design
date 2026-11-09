"""Cross-modal discovery engine and search strategies.

A *candidate* is (source feature, target feature, temporal scale, lag
window).  Evaluation happens in three stages of increasing cost:

  A  screen   pooled lagged cross-correlation on a data subsample with a
              small circular-shift null (adaptive strategy only)
  B  null     pooled lagged cross-correlation on all training data, null from
              ``n_surrogates`` circular shifts (max over the lag window, so the
              lag search itself is accounted for); Benjamini-Hochberg FDR
  C  predict  does the source, at the found lag, predict the target on a
              later validation stretch *beyond the target's own recent
              history*?  Null: the source shifted in time (no refit).

Strategies:
  exhaustive  every candidate gets A-free full B and C (uniform effort)
  staged      B for all, C only for FDR survivors (classic filter cascade)
  adaptive    Thompson-sampling bandit over (source family, target family)
              arms with a learned preference over temporal scales; barren
              arms are retired early; only promoted candidates get B and C.
"""
from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .data import Dataset, family, modality
from .stats import bh_fdr, max_lag_stat, p_from_null, pooled_xcorr, shift_null
from .store import Compute, FeatureStore


@dataclass
class SearchConfig:
    scales_s: tuple = (0.0, 1.0, 4.0)
    max_lag_av_s: float = 2.0
    max_lag_physio_s: float = 8.0
    n_surrogates: int = 999
    min_shift_s: float = 10.0
    alpha_fdr: float = 0.05
    alpha_val: float = 0.05
    val_split: float = 0.65
    n_val_surrogates: int = 99
    horizon_s: dict = None  # target modality -> prediction horizon
    exclude: tuple = ("video.tracking",)
    # adaptive
    screen_fraction: float = 0.4
    screen_surrogates: int = 49
    screen_alpha: float = 0.05
    min_pulls: int = 3
    retire_below: float = 0.2

    def __post_init__(self):
        if self.horizon_s is None:
            self.horizon_s = {"video": 0.5, "audio": 0.5, "physio": 1.0, "pattern": 0.5}


@dataclass(frozen=True)
class Candidate:
    source: str
    target: str
    scale: float
    view: str  # performer | viewer
    lag_min: int
    lag_max: int

    @property
    def key(self) -> str:
        return f"{self.source}->{self.target}@{self.scale:g}s"

    @property
    def arm(self) -> tuple:
        return (self.view, family(self.source), family(self.target))


def build_candidates(ds: Dataset, cfg: SearchConfig, sources_extra: list[str] | None = None,
                     only_extra: bool = False) -> list[Candidate]:
    r = ds.rate
    keep = lambda f: not any(f.startswith(e) for e in cfg.exclude)
    cands = []
    if not only_extra and ds.performer:
        vf = [f for f in ds.features("performer", "video.") if keep(f)]
        af = [f for f in ds.features("performer", "audio.") if keep(f)]
        L = int(cfg.max_lag_av_s * r)
        for s in vf:
            for t in af:
                for sc in cfg.scales_s:
                    cands.append(Candidate(s, t, sc, "performer", -L, L))
    if ds.viewer:
        pf = [f for f in ds.features("viewer", "physio.") if keep(f)]
        if only_extra:
            srcs = list(sources_extra or [])
        else:
            srcs = [f for f in ds.features("viewer") if modality(f) in ("video", "audio") and keep(f)]
            srcs += list(sources_extra or [])
        L = int(cfg.max_lag_physio_s * r)
        for s in srcs:
            for t in pf:
                for sc in cfg.scales_s:
                    cands.append(Candidate(s, t, sc, "viewer", 0, L))
    return cands


# ---------------------------------------------------------------- stage B ---

def stage_b(store: FeatureStore, c: Candidate, n_surr: int, min_shift: int, rng) -> dict:
    lags = np.arange(c.lag_min, c.lag_max + 1)
    cs, w = pooled_xcorr(store, c.source, c.target, c.scale)
    r, lag, _ = max_lag_stat(cs, w, lags)
    null = shift_null(cs, w, lags, n_surr, min_shift, rng, store)
    p, p_emp = p_from_null(r, null)
    return {"r": r, "lag": lag, "lag_s": lag / store.rate, "p": p, "p_emp": p_emp,
            "null_q95": float(np.quantile(null, 0.95))}


# ---------------------------------------------------------------- stage C ---

def lagged(x: np.ndarray, lag: int) -> np.ndarray:
    out = np.full(x.size, np.nan)
    if lag >= 0:
        out[lag:] = x[:x.size - lag] if lag else x
    else:
        out[:lag] = x[-lag:]
    return out


def roles(c: Candidate, lag: int) -> tuple[str, str, int]:
    """(predictor, response, positive lag): the leader predicts the follower."""
    if lag >= 0:
        return c.source, c.target, lag
    return c.target, c.source, -lag


def self_lags(response: str, cfg: SearchConfig, rate: float) -> list[int]:
    h = int(round(cfg.horizon_s.get(modality(response), 0.5) * rate))
    return [h, h + int(rate), h + int(2 * rate)]


def design(store: FeatureStore, response: str, preds: list[tuple[str, float, int]], slags: list[int],
           resp_scale: float, part: str, val_split: float):
    """Rows of [self-history..., predictor lags...] and response values.
    part: 'fit' (first val_split of each segment), 'val' (rest) or 'all'."""
    Y = store.z(response, resp_scale)
    P = {(n, s): store.filled(n, s) for n, s, _ in preds}
    Xs, Xp, ys, seg = [], [], [], []
    for i, y in enumerate(Y):
        n = y.size
        cut = int(val_split * n)
        sl = slice(0, cut) if part == "fit" else slice(cut, n) if part == "val" else slice(0, n)
        yf = np.nan_to_num(y, nan=0.0)
        S = np.column_stack([lagged(yf, L) for L in slags]) if slags else np.zeros((n, 0))
        X = np.column_stack([lagged(P[(nm, sc)][i], L) for nm, sc, L in preds]) if preds else np.zeros((n, 0))
        rows = np.arange(n)[sl]
        ok = np.isfinite(y[rows]) & np.all(np.isfinite(S[rows]), axis=1) & np.all(np.isfinite(X[rows]), axis=1)
        rows = rows[ok]
        Xs.append(S[rows]); Xp.append(X[rows]); ys.append(y[rows]); seg.append(np.full(rows.size, i))
    cat = lambda a, k: np.concatenate(a) if a else np.zeros((0, k))
    return (cat(Xs, len(slags)), cat(Xp, len(preds)), np.concatenate(ys) if ys else np.zeros(0),
            np.concatenate(seg) if seg else np.zeros(0, int))


def ols(X: np.ndarray, y: np.ndarray):
    A = np.column_stack([np.ones(len(X)), X])
    beta, *_ = np.linalg.lstsq(A, y, rcond=None)
    return beta


def ols_pred(beta, X):
    return beta[0] + X @ beta[1:]


def bits_saved(sse_base, sse_model, n_val, extra_params, n_fit) -> float:
    if sse_model <= 0 or sse_base <= 0 or n_val == 0:
        return 0.0
    gain = 0.5 * n_val * np.log2(sse_base / sse_model) - 0.5 * extra_params * np.log2(max(n_fit, 2))
    return float(gain / n_val)


def circ_shift_within(x: np.ndarray, seg: np.ndarray, rng, min_shift: int) -> np.ndarray:
    out = x.copy()
    for s in np.unique(seg):
        m = seg == s
        n = int(m.sum())
        if n < 4:
            continue
        ms = min(min_shift, max(1, n // 4))
        out[m] = np.roll(x[m], int(rng.integers(ms, max(ms + 1, n - ms))), axis=0)
    return out


def stage_c(store: FeatureStore, c: Candidate, lag: int, cfg: SearchConfig, rng) -> dict:
    pred, resp, tau = roles(c, lag)
    sl = self_lags(resp, cfg, store.rate)
    Sf, Xf, yf, _ = design(store, resp, [(pred, c.scale, tau)], sl, c.scale, "fit", cfg.val_split)
    Sv, Xv, yv, segv = design(store, resp, [(pred, c.scale, tau)], sl, c.scale, "val", cfg.val_split)
    if len(yf) < 50 or len(yv) < 30:
        return {"val_gain": np.nan, "val_p": 1.0, "val_bits": 0.0, "predictor": pred, "response": resp, "tau": tau}
    b_self = ols(Sf, yf)
    b_full = ols(np.column_stack([Sf, Xf]), yf)
    sst = float(np.sum((yv - yv.mean()) ** 2)) or 1.0
    sse_self = float(np.sum((yv - ols_pred(b_self, Sv)) ** 2))
    pv = ols_pred(b_full, np.column_stack([Sv, Xv]))
    sse_full = float(np.sum((yv - pv) ** 2))
    gain = (sse_self - sse_full) / sst
    ms = int(cfg.min_shift_s * store.rate)
    null = np.empty(cfg.n_val_surrogates)
    for k in range(cfg.n_val_surrogates):
        Xs = circ_shift_within(Xv, segv, rng, ms)
        null[k] = (sse_self - float(np.sum((yv - ols_pred(b_full, np.column_stack([Sv, Xs]))) ** 2))) / sst
    p = (1 + int((null >= gain).sum())) / (1 + null.size)
    nr, pc = len(yf), Sf.shape[1] + 2
    store.compute.add("fit", 2 * nr * pc * pc)
    store.compute.add("val_null", cfg.n_val_surrogates * len(yv) * pc)
    return {"val_gain": float(gain), "val_p": float(p), "val_r2_self": float(1 - sse_self / sst),
            "val_bits": bits_saved(sse_self, sse_full, len(yv), 1, len(yf)),
            "beta_source": float(b_full[-1]), "predictor": pred, "response": resp, "tau": tau}


# ------------------------------------------------------------- strategies ---

@dataclass
class SearchResult:
    strategy: str
    results: dict  # candidate key -> record
    compute: Compute
    confirmed: list  # candidate keys
    curve: list  # (cumulative ops, cumulative screened, key) in evaluation order
    arms: dict = None
    n_candidates: int = 0


def _stores(ds: Dataset, compute: Compute, fraction: float = 1.0) -> dict:
    return {v: FeatureStore(ds.segments(v, "train"), compute, fraction) for v in ("performer", "viewer")
            if ds.segments(v, "train")}


def _finish(name, cands, recs, stores, cfg, rng, compute, curve, m_total, run_c_for_all=False, arms=None):
    tested = [k for k in recs if "p" in recs[k]]
    pv = np.array([recs[k]["p"] for k in tested])
    sig = bh_fdr(pv, cfg.alpha_fdr, m=m_total)
    byk = {c.key: c for c in cands}
    for k, s in zip(tested, sig):
        recs[k]["fdr_pass"] = bool(s)
    for k in tested:
        rec = recs[k]
        if rec["fdr_pass"] or run_c_for_all:
            c = byk[k]
            rec.update(stage_c(stores[c.view], c, rec["lag"], cfg, rng))
    confirmed = [k for k in tested if recs[k].get("fdr_pass") and recs[k].get("val_gain", np.nan) > 0
                 and recs[k].get("val_p", 1) < cfg.alpha_val and recs[k].get("val_bits", 0) > 0]
    for k in recs:
        recs[k]["confirmed"] = k in confirmed
        recs[k]["stage_reached"] = ("C" if "val_gain" in recs[k] else "B" if "p" in recs[k] else "A")
    return SearchResult(name, recs, compute, confirmed, curve, arms, len(cands))


def run_exhaustive(ds, cands, cfg, seed=0, stage_c_all=True) -> SearchResult:
    rng = np.random.default_rng(seed)
    compute = Compute()
    recs, curve = {}, []
    with compute.timer():
        stores = _stores(ds, compute)
        ms = int(cfg.min_shift_s * ds.rate)
        order = rng.permutation(len(cands))
        for i in order:
            c = cands[i]
            recs[c.key] = {"candidate": c, **stage_b(stores[c.view], c, cfg.n_surrogates, ms, rng)}
            curve.append((compute.total_ops, len(curve) + 1, c.key))
        res = _finish("exhaustive" if stage_c_all else "staged", cands, recs, stores, cfg, rng, compute,
                      curve, len(cands), run_c_for_all=stage_c_all)
    return res


def run_staged(ds, cands, cfg, seed=0) -> SearchResult:
    return run_exhaustive(ds, cands, cfg, seed, stage_c_all=False)


def run_adaptive(ds, cands, cfg, seed=0) -> SearchResult:
    rng = np.random.default_rng(seed)
    compute = Compute()
    recs, curve = {}, []
    with compute.timer():
        stores = _stores(ds, compute)
        screen = _stores(ds, compute, cfg.screen_fraction)
        ms = int(cfg.min_shift_s * ds.rate)
        arms: dict = {}
        for c in cands:
            arms.setdefault(c.arm, []).append(c)
        for a in arms.values():
            rng.shuffle(a)
        post = {a: [1.0, 1.0] for a in arms}  # Beta(successes+1, failures+1)
        pulls = {a: 0 for a in arms}
        scale_post = {s: [1.0, 1.0] for s in cfg.scales_s}
        retired = set()
        while True:
            live = [a for a in arms if arms[a] and a not in retired]
            if not live:
                break
            explore = [a for a in live if pulls[a] < cfg.min_pulls]
            if explore:
                arm = explore[0]
            else:
                th = {a: rng.beta(*post[a]) for a in live}
                arm = max(th, key=th.get)
            # pick candidate in arm by sampled scale preference
            sc_draw = {s: rng.beta(*v) for s, v in scale_post.items()}
            arms[arm].sort(key=lambda c: -sc_draw[c.scale])
            c = arms[arm].pop(0)
            st = screen[c.view]
            cs, w = pooled_xcorr(st, c.source, c.target, c.scale)
            lags = np.arange(c.lag_min, c.lag_max + 1)
            r, lag, _ = max_lag_stat(cs, w, lags)
            null = shift_null(cs, w, lags, cfg.screen_surrogates, ms, rng, st)
            p_s, _ = p_from_null(r, null)
            success = p_s < cfg.screen_alpha
            recs[c.key] = {"candidate": c, "screen_r": r, "screen_p": p_s}
            post[arm][0 if success else 1] += 1
            scale_post[c.scale][0 if success else 1] += 1
            pulls[arm] += 1
            if success:
                recs[c.key].update(stage_b(stores[c.view], c, cfg.n_surrogates, ms, rng))
            mean = post[arm][0] / sum(post[arm])
            if pulls[arm] >= cfg.min_pulls and mean < cfg.retire_below:
                retired.add(arm)
            curve.append((compute.total_ops, len(curve) + 1, c.key))
        arm_report = {f"{a[1]} -> {a[2]}": {"pulls": pulls[a], "successes": int(post[a][0] - 1),
                                            "posterior_mean": post[a][0] / sum(post[a]),
                                            "retired": a in retired, "untested": len(arms[a])}
                      for a in post}
        arm_report["__scales__"] = {f"{s:g}s": v[0] / sum(v) for s, v in scale_post.items()}
        res = _finish("adaptive", cands, recs, stores, cfg, rng, compute, curve, len(cands), arms=arm_report)
    return res


STRATEGIES = {"exhaustive": run_exhaustive, "staged": run_staged, "adaptive": run_adaptive}
