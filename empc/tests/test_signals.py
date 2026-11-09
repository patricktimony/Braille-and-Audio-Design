import numpy as np
import pandas as pd

from empc.physio import physio_streams
from empc.signal_utils import interp_gaps, robust_z
from empc.stats import bh_fdr, max_lag_stat, p_from_null, pooled_xcorr, shift_null
from empc.store import FeatureStore
from empc.data import Segment
from empc.sync import to_grid


def test_to_grid_bin_average_and_delay():
    t = np.arange(0, 10, 0.01)
    v = (t >= 5).astype(float)
    grid = np.arange(0, 10, 0.1)
    g = to_grid(t, v, grid, 10.0)
    assert abs(g[grid < 4.9].mean()) < 1e-9 and np.all(g[grid > 5.1] == 1)
    g2 = to_grid(t, v, grid, 10.0, delay_s=1.0)  # sensor reports 1 s late -> step moves to 4 s
    assert g2[np.searchsorted(grid, 4.2)] == 1 and g2[np.searchsorted(grid, 3.8)] == 0


def test_to_grid_leaves_long_gaps_missing():
    t = np.array([0, 1, 2, 10, 11.0])
    g = to_grid(t, t, np.arange(0, 11, 0.5), 2.0, max_gap_s=1.5)
    assert np.isnan(g[12])  # 6 s: far from samples
    assert np.isfinite(g[2])


def test_interp_gaps():
    x = np.array([1, np.nan, 3, np.nan, np.nan, np.nan, np.nan, 8.0])
    y = interp_gaps(x, 2)
    assert y[1] == 2 and np.isnan(y[4])


def _ar1(rng, n, phi=0.95):
    x = np.zeros(n)
    for i in range(1, n):
        x[i] = phi * x[i - 1] + rng.normal()
    return x


def _store(xs, ys):
    segs = [Segment(f"u{i}", "train", pd.DataFrame({"a": x, "b": y}), 10.0) for i, (x, y) in enumerate(zip(xs, ys))]
    return FeatureStore(segs)


def test_shift_null_controls_false_positives_on_autocorrelated_noise():
    rng = np.random.default_rng(0)
    hits = 0
    for k in range(60):
        st = _store([_ar1(rng, 600) for _ in range(3)], [_ar1(rng, 600) for _ in range(3)])
        cs, w = pooled_xcorr(st, "a", "b", 0.0)
        lags = np.arange(-20, 21)
        r, _, _ = max_lag_stat(cs, w, lags)
        p, _ = p_from_null(r, shift_null(cs, w, lags, 199, 100, rng))
        hits += p < 0.05
    assert hits <= 8  # nominal 3 of 60


def test_planted_lag_is_recovered():
    rng = np.random.default_rng(1)
    xs = [rng.normal(size=800) for _ in range(3)]
    ys = [np.roll(x, 7) + rng.normal(size=800) for x in xs]
    st = _store(xs, ys)
    cs, w = pooled_xcorr(st, "a", "b", 0.0)
    r, lag, _ = max_lag_stat(cs, w, np.arange(-20, 21))
    assert lag == 7 and r > 0.5
    p, _ = p_from_null(r, shift_null(cs, w, np.arange(-20, 21), 199, 100, rng))
    assert p < 1e-6


def test_bh_counts_untested_hypotheses():
    p = np.array([0.001, 0.01, 0.04])
    assert bh_fdr(p, 0.05).sum() == 3
    assert bh_fdr(p, 0.05, m=100).sum() == 0


def test_robust_z_keeps_nan():
    z = robust_z(np.array([1, 2, np.nan, 4, 5.0]))
    assert np.isnan(z[2]) and abs(np.nanmean(z)) < 1


def test_hrv_only_where_enough_beats():
    beats = np.cumsum(np.full(200, 0.8))
    df = pd.DataFrame({"time_s": beats, "ibi_ms": 800 + np.random.default_rng(0).normal(0, 20, 200)})
    s, info, syn = physio_streams([df])
    assert "physio.hrv.rmssd" in s and "physio.hr.bpm" in s and not syn
    sparse = pd.DataFrame({"time_s": beats[::20], "ibi_ms": np.full(10, 800.0)})
    s2, _, _ = physio_streams([sparse])
    assert "physio.hrv.rmssd" not in s2
