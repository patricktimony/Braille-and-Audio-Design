"""Statistics: lagged cross-correlation, surrogate nulls, FDR."""
from __future__ import annotations

import numpy as np

from .store import FeatureStore


def pooled_xcorr(store: FeatureStore, src: str, tgt: str, scale: float):
    """Per-segment circular cross-correlation c_s[k] = corr(x(t-k), y(t)),
    i.e. positive k means the source leads.  Returns (list of c_s, weights)."""
    fx, fy = store.fft(src, scale), store.fft(tgt, scale)
    cs, ws = [], []
    for (X, ex, n), (Y, ey, _) in zip(fx, fy):
        if ex <= 0 or ey <= 0:
            cs.append(np.zeros(n))
        else:
            cs.append(np.fft.irfft(np.conj(X) * Y, n) / np.sqrt(ex * ey))
        ws.append(n)
        store.compute.add("xcorr", n * np.log2(max(n, 2)))
    w = np.asarray(ws, float)
    return cs, w / w.sum() if w.sum() else w


def max_lag_stat(cs, w, lags: np.ndarray):
    pooled = sum(wi * c[lags % c.size] for c, wi in zip(cs, w))
    i = int(np.argmax(np.abs(pooled)))
    return float(pooled[i]), int(lags[i]), pooled


def shift_null(cs, w, lags: np.ndarray, n_surr: int, min_shift: int, rng, store=None) -> np.ndarray:
    """Null distribution of max |r| over the lag window when the source is
    circularly shifted by a random amount in every segment.  Shifting
    preserves each signal's own autocorrelation, so slow signals do not
    produce spurious 'significance'."""
    tot = np.zeros((n_surr, lags.size))
    for c, wi in zip(cs, w):
        n = c.size
        ms = min(min_shift, max(1, n // 4))
        sh = rng.integers(ms, max(ms + 1, n - ms), size=n_surr)
        idx = (lags[None, :] + sh[:, None]) % n
        tot += wi * c[idx]
    if store is not None:
        store.compute.add("surrogate", n_surr * lags.size * len(cs))
    return np.abs(tot).max(axis=1)


def p_from_null(obs: float, null: np.ndarray) -> tuple[float, float]:
    """Empirical p-value, and a Gumbel-tail extrapolation for when the
    observed value is beyond all surrogates (needed for FDR over thousands
    of candidates).  Returns (p_used, p_empirical)."""
    obs = abs(obs)
    S = null.size
    exceed = int((null >= obs).sum())
    p_emp = (1 + exceed) / (1 + S)
    if exceed >= 10:
        return p_emp, p_emp
    beta = max(np.std(null) * np.sqrt(6) / np.pi, 1e-9)
    mu = np.mean(null) - 0.5772 * beta
    zg = (obs - mu) / beta
    p_g = -np.expm1(-np.exp(-zg)) if zg < 700 else 0.0
    return float(max(min(p_emp, p_g), 1e-300)), p_emp


def bh_fdr(p: np.ndarray, alpha: float, m: int | None = None) -> np.ndarray:
    """Benjamini-Hochberg.  ``m`` may exceed len(p) to count untested
    hypotheses as p = 1 (conservative accounting for adaptive search)."""
    p = np.asarray(p, float)
    m = m or p.size
    if p.size == 0:
        return np.zeros(0, bool)
    order = np.argsort(p)
    thresh = alpha * np.arange(1, p.size + 1) / m
    ok = p[order] <= thresh
    k = np.max(np.where(ok)[0]) + 1 if ok.any() else 0
    out = np.zeros(p.size, bool)
    out[order[:k]] = True
    return out
