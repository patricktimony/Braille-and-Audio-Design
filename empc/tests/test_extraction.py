import numpy as np

from empc.extract_audio import features_from_waveform
from empc.extract_video import features_from_landmarks
from empc.synthetic import ASPECT, simulate_performer


def test_landmark_features_invariant_to_body_size_and_position():
    rng = np.random.default_rng(0)
    perf = simulate_performer(rng, duration=20)
    lm, t = perf["landmarks"], perf["times"]
    a = features_from_landmarks(lm, t, ASPECT)
    lm2 = lm.copy()
    lm2[:, :, :3] = lm2[:, :, :3] * 0.5 + 0.2  # smaller body, shifted in frame
    b = features_from_landmarks(lm2, t, ASPECT)
    for k in ("video.wrist_r.speed", "video.wrist_r.y", "video.hands.distance"):
        assert np.allclose(a[k][1], b[k][1], atol=1e-6, equal_nan=True), k


def test_frame_rate_normalisation():
    rng = np.random.default_rng(1)
    perf = simulate_performer(rng, duration=20)
    a = features_from_landmarks(perf["landmarks"], perf["times"], ASPECT)
    b = features_from_landmarks(perf["landmarks"][::2], perf["times"][::2], ASPECT)
    sa, sb = np.nanmean(a["video.wrist_r.speed"][1]), np.nanmean(b["video.wrist_r.speed"][1])
    assert abs(sa - sb) / sa < 0.35  # speeds in shoulder-widths per second, not per frame


def test_depth_is_marked_as_estimate():
    rng = np.random.default_rng(2)
    perf = simulate_performer(rng, duration=10)
    names = features_from_landmarks(perf["landmarks"], perf["times"], ASPECT)
    zs = [n for n in names if "z" in n.split(".")[-1]]
    assert zs and all(n.endswith("_est") for n in zs)


def test_audio_features_track_bursts_and_pitch():
    sr = 16000
    t = np.arange(4 * sr) / sr
    y = 0.001 * np.random.default_rng(0).normal(size=t.size)
    on = (t > 1) & (t < 2)
    y[on] += 0.3 * np.sin(2 * np.pi * 200 * t[on])
    f = features_from_waveform(y.astype(np.float32), sr)
    tt, rms = f["audio.energy.rms_db"]
    assert rms[(tt > 1.2) & (tt < 1.8)].mean() > rms[tt < 0.8].mean() + 30
    _, st = f["audio.pitch.f0_st"]
    expected = 12 * np.log2(200 / 100)
    assert abs(np.nanmedian(st[(tt > 1.2) & (tt < 1.8)]) - expected) < 0.5
    _, sil = f["audio.timing.silence"]
    assert sil[tt < 0.8].mean() > 0.9 and sil[(tt > 1.2) & (tt < 1.8)].mean() < 0.1
