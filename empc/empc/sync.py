"""Place streams with different sampling rates and delays on one time grid.

Each stream is a (times_s, values) pair at its native rate.  Known recording
delays are subtracted *before* resampling, so a sensor that reports 0.5 s late
is shifted back by 0.5 s.  Streams faster than the grid are bin-averaged;
slower streams are linearly interpolated with a maximum gap, beyond which the
grid value is left missing rather than invented.
"""
from __future__ import annotations

import numpy as np
import pandas as pd


def make_grid(duration_s: float, rate: float, start_s: float = 0.0) -> np.ndarray:
    n = int(np.floor(duration_s * rate))
    return start_s + np.arange(n) / rate


def to_grid(t: np.ndarray, v: np.ndarray, grid: np.ndarray, rate: float,
            delay_s: float = 0.0, max_gap_s: float = 2.0) -> np.ndarray:
    t = np.asarray(t, float) - delay_s
    v = np.asarray(v, float)
    ok = np.isfinite(t) & np.isfinite(v)
    t, v = t[ok], v[ok]
    out = np.full(grid.size, np.nan)
    if t.size < 2:
        return out
    order = np.argsort(t)
    t, v = t[order], v[order]
    native_rate = 1.0 / np.median(np.diff(t)) if t.size > 1 else 0
    if native_rate >= 1.5 * rate:
        # bin average: bin i covers [grid_i - 0.5/rate, grid_i + 0.5/rate)
        b = np.floor((t - grid[0]) * rate + 0.5).astype(int)
        m = (b >= 0) & (b < grid.size)
        s = np.bincount(b[m], weights=v[m], minlength=grid.size)
        c = np.bincount(b[m], minlength=grid.size)
        with np.errstate(invalid="ignore"):
            out = np.where(c > 0, s / np.maximum(c, 1), np.nan)
        return out
    out = np.interp(grid, t, v, left=np.nan, right=np.nan)
    # blank grid points too far from any real sample
    pos = np.searchsorted(t, grid)
    left = np.abs(grid - t[np.clip(pos - 1, 0, t.size - 1)])
    right = np.abs(t[np.clip(pos, 0, t.size - 1)] - grid)
    out[np.minimum(left, right) > max_gap_s] = np.nan
    return out


def build_frame(streams: dict[str, tuple[np.ndarray, np.ndarray]], duration_s: float,
                rate: float, delays: dict[str, float] | None = None,
                max_gap_s: float = 2.0) -> pd.DataFrame:
    """streams: feature name -> (times, values).  delays: name prefix -> s."""
    delays = delays or {}
    grid = make_grid(duration_s, rate)
    cols = {}
    for name, (t, v) in streams.items():
        d = 0.0
        for prefix, val in delays.items():
            if name.startswith(prefix):
                d = val
        cols[name] = to_grid(t, v, grid, rate, delay_s=d, max_gap_s=max_gap_s)
    return pd.DataFrame(cols, index=pd.Index(grid, name="time_s"))
