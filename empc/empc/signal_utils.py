"""Small, dependency-light signal helpers."""
from __future__ import annotations

import numpy as np
from scipy import signal as sps


def interp_gaps(x: np.ndarray, max_gap: int) -> np.ndarray:
    """Linearly fill NaN runs no longer than ``max_gap`` samples."""
    x = np.asarray(x, dtype=float).copy()
    n = x.size
    ok = np.isfinite(x)
    if ok.sum() < 2:
        return x
    idx = np.arange(n)
    filled = np.interp(idx, idx[ok], x[ok])
    # find NaN runs
    isnan = ~ok
    if not isnan.any():
        return x
    d = np.diff(np.concatenate([[0], isnan.astype(int), [0]]))
    starts, ends = np.where(d == 1)[0], np.where(d == -1)[0]
    for s, e in zip(starts, ends):
        if s == 0 or e == n:  # do not extrapolate edges
            continue
        if e - s <= max_gap:
            x[s:e] = filled[s:e]
    return x


def moving_average(x: np.ndarray, width: int) -> np.ndarray:
    """NaN-aware centred moving average."""
    x = np.asarray(x, dtype=float)
    if width <= 1:
        return x.copy()
    ok = np.isfinite(x)
    k = np.ones(width)
    num = np.convolve(np.where(ok, x, 0.0), k, mode="same")
    den = np.convolve(ok.astype(float), k, mode="same")
    out = np.full_like(x, np.nan)
    good = den >= max(1.0, 0.5 * width)
    out[good] = num[good] / den[good]
    return out


def robust_z(x: np.ndarray) -> np.ndarray:
    """Median/IQR standardisation, then unit variance; NaN preserved."""
    x = np.asarray(x, dtype=float)
    v = x[np.isfinite(x)]
    if v.size < 3:
        return np.full_like(x, np.nan)
    med = np.median(v)
    z = x - med
    sd = np.nanstd(z)
    if sd < 1e-12:
        return np.zeros_like(x) * np.where(np.isfinite(x), 1.0, np.nan)
    z = z / sd
    return np.clip(z, -8, 8)


def savgol_deriv(x: np.ndarray, fs: float, window_s: float = 0.2, deriv: int = 1) -> np.ndarray:
    """Smoothed derivative; NaNs are bridged temporarily then restored."""
    x = np.asarray(x, dtype=float)
    ok = np.isfinite(x)
    if ok.sum() < 5:
        return np.full_like(x, np.nan)
    idx = np.arange(x.size)
    xf = np.interp(idx, idx[ok], x[ok])
    w = max(5, int(round(window_s * fs)) | 1)
    if w > x.size:
        w = x.size if x.size % 2 else x.size - 1
    if w < 5:
        return np.full_like(x, np.nan)
    d = sps.savgol_filter(xf, w, 3 if w > 3 else 2, deriv=deriv, delta=1.0 / fs)
    d[~ok] = np.nan
    return d


def rolling_periodicity(x: np.ndarray, fs: float, window_s: float = 4.0,
                        min_period_s: float = 0.3, max_period_s: float = 2.0,
                        step_s: float = 0.25) -> tuple[np.ndarray, np.ndarray]:
    """Local oscillation strength (peak autocorrelation) and its period (s).

    Computed on sliding windows and linearly interpolated back to every sample.
    """
    x = np.asarray(x, dtype=float)
    n = x.size
    w = int(window_s * fs)
    step = max(1, int(step_s * fs))
    lo, hi = max(1, int(min_period_s * fs)), int(max_period_s * fs)
    centres, strength, period = [], [], []
    if n < w or hi >= w:
        return np.full(n, np.nan), np.full(n, np.nan)
    for s in range(0, n - w + 1, step):
        seg = x[s:s + w]
        if np.isfinite(seg).mean() < 0.8:
            continue
        seg = np.nan_to_num(seg - np.nanmean(seg))
        den = np.dot(seg, seg)
        if den < 1e-12:
            continue
        ac = np.correlate(seg, seg, mode="full")[w - 1:] / den
        k = lo + int(np.argmax(ac[lo:hi + 1]))
        centres.append(s + w / 2)
        strength.append(ac[k])
        period.append(k / fs)
    if len(centres) < 2:
        return np.full(n, np.nan), np.full(n, np.nan)
    idx = np.arange(n)
    st = np.interp(idx, centres, strength, left=np.nan, right=np.nan)
    pe = np.interp(idx, centres, period, left=np.nan, right=np.nan)
    return st, pe


def rolling_corr(a: np.ndarray, b: np.ndarray, width: int) -> np.ndarray:
    a = np.asarray(a, float)
    b = np.asarray(b, float)
    ma, mb = moving_average(a, width), moving_average(b, width)
    cov = moving_average(a * b, width) - ma * mb
    va = moving_average(a * a, width) - ma ** 2
    vb = moving_average(b * b, width) - mb ** 2
    with np.errstate(invalid="ignore", divide="ignore"):
        r = cov / np.sqrt(np.maximum(va, 1e-12) * np.maximum(vb, 1e-12))
    return np.clip(r, -1, 1)
