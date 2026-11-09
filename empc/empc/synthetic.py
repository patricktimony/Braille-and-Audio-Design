"""Explicitly labelled SYNTHETIC data with known, planted relationships.

Purpose: test that the pipeline (1) recovers relationships that truly exist,
(2) rejects relationships that do not, and (3) reports when nothing is found.
Synthetic results are software tests, never scientific evidence about people.

World model (each video = one simulated performer; each viewer = one
simulated physiological responder):
  * Right-arm "strokes" (random times/amplitudes) move the right wrist/elbow.
  * Left-arm strokes and head nods occur independently (distractors).
  * 80 % of right strokes are followed ~0.25 s after their apex by a voiced
    sound burst whose loudness and pitch grow with stroke amplitude (GT1/GT2).
  * Other sound bursts occur at random.
  * EDA: skin-conductance responses ~2 s after bursts that followed *large*
    strokes (GT3), with viewer-specific gain and latency.
  * Pupil: dilation peaking ~0.9 s after every sound-burst onset (GT4).
  * Heart rate: brief deceleration ~3 s after the start of movement pauses (GT5, weak).
  * Respiration: independent of everything (null channel).
With ``coupled=False`` every cross-modal link is removed (null world).
"""
from __future__ import annotations

import numpy as np
import pandas as pd

from .extract_audio import features_from_waveform
from .extract_video import features_from_landmarks
from .ingest import assemble
from .physio import physio_streams

BASE = {0: (0.5, 0.25), 11: (0.58, 0.42), 12: (0.42, 0.42), 13: (0.62, 0.58), 14: (0.38, 0.58),
        15: (0.62, 0.72), 16: (0.38, 0.72), 23: (0.55, 0.8), 24: (0.45, 0.8)}
ASPECT = 4.0 / 3.0

GROUND_TRUTH = [
    {"id": "GT1", "description": "right-arm movement -> sound loudness/onset (sound follows by ~0.2-0.8 s)",
     "sources": ["video.wrist_r", "video.elbow_r", "video.body", "video.hands"],
     "targets": ["audio.energy", "audio.timing", "audio.spectral", "audio.pitch"], "lag_s": (-0.2, 1.5)},
    {"id": "GT3", "description": "sound bursts after large strokes -> EDA response (~2 s later)",
     "sources": ["audio", "video.wrist_r", "video.elbow_r", "video.body", "video.hands", "pattern"],
     "targets": ["physio.eda"], "lag_s": (0.5, 6.0)},
    {"id": "GT4", "description": "sound-burst onsets -> pupil dilation (~0.9 s later)",
     "sources": ["audio", "video.wrist_r", "video.elbow_r", "video.body", "video.hands", "pattern"],
     "targets": ["physio.pupil"], "lag_s": (0.0, 3.0)},
    {"id": "GT5", "description": "movement pauses -> heart-rate deceleration (~3 s later; weak by design)",
     "sources": ["video", "audio", "pattern"], "targets": ["physio.hr", "physio.hrv"], "lag_s": (0.0, 8.0)},
]


def dependency_exists(source: str, target: str) -> bool:
    """True when the generator creates *some* statistical dependency between
    the two feature families (directly or through a shared cause)."""
    def match(name, prefixes):
        return any(name == p or name.startswith(p + ".") or name.startswith(p) for p in prefixes)
    for s, t in ((source, target), (target, source)):
        for gt in GROUND_TRUTH:
            if match(s, gt["sources"]) and match(t, gt["targets"]):
                if "video.head" in s or "video.wrist_l" in s or "video.elbow_l" in s:
                    if gt["id"] != "GT5":
                        continue
                return True
    return False


def _events(rng, duration, rate, min_gap):
    t, out = 0.0, []
    while True:
        t += min_gap + rng.exponential(1.0 / rate)
        if t > duration - 2:
            return out
        out.append(t)


def _strokes(rng, duration, rate):
    return [(t0, rng.uniform(0.4, 0.9), 0.08 * np.exp(rng.normal(0, 0.4)), np.deg2rad(rng.uniform(60, 120)))
            for t0 in _events(rng, duration, rate, 1.2)]


def simulate_performer(rng, duration=120.0, fps=30.0, sr=16000, coupled=True):
    T = int(duration * fps)
    t = np.arange(T) / fps
    lm = np.zeros((T, 33, 4))
    lm[:, :, 0], lm[:, :, 1], lm[:, :, 3] = 0.5, 0.6, 0.95
    for j, (x, y) in BASE.items():
        lm[:, j, 0], lm[:, j, 1] = x, y
    lm[:, :, 2] = -0.05
    right, left = _strokes(rng, duration, 0.3), _strokes(rng, duration, 0.2)

    def apply(strokes, wrist, elbow, sign):
        for t0, dur, A, ang in strokes:
            m = (t >= t0) & (t < t0 + dur)
            d = A * np.sin(np.pi * (t[m] - t0) / dur) ** 2
            dx, dy = sign * np.cos(ang) * d / ASPECT, -np.sin(ang) * d
            lm[m, wrist, 0] += dx
            lm[m, wrist, 1] += dy
            lm[m, wrist, 2] -= 0.5 * d
            lm[m, elbow, 0] += 0.4 * dx
            lm[m, elbow, 1] += 0.4 * dy
    apply(right, 16, 14, -1)
    apply(left, 15, 13, +1)
    for tn in _events(rng, duration, 0.15, 1.0):
        m = (t >= tn) & (t < tn + 0.8)
        lm[m, 0, 1] += 0.01 * np.sin(2 * np.pi * 2.5 * (t[m] - tn))
    sway = 0.01 * np.sin(2 * np.pi * 0.1 * t + rng.uniform(0, 6.3))
    lm[:, :, 0] += sway[:, None]
    lm[:, :, :2] += rng.normal(0, 0.002, (T, 33, 2))
    lm[:, :, 2] += rng.normal(0, 0.02, (T, 33))
    for td in _events(rng, duration, 0.05, 2.0):  # tracking dropouts
        m = (t >= td) & (t < td + 0.3)
        lm[m, rng.choice([15, 16]), 3] = 0.2

    # ---- audio
    n = int(duration * sr)
    ta = np.arange(n) / sr
    y = rng.normal(0, 0.002, n).astype(np.float64)
    bursts = []  # (onset, from_large_stroke)
    amps = [s[2] for s in right]
    med_amp = np.median(amps) if amps else 0.08
    for t0, dur, A, _ in right:
        if rng.random() < 0.8:
            onset = (t0 + 0.5 * dur + 0.25 + rng.normal(0, 0.04)) if coupled else rng.uniform(1, duration - 2)
            bursts.append((onset, A, A > med_amp))
    for tb in _events(rng, duration, 0.08, 1.0):
        bursts.append((tb, 0.08 * np.exp(rng.normal(0, 0.4)), False))
    for onset, A, _ in bursts:
        bd = rng.uniform(0.25, 0.5)
        s, e = int(onset * sr), min(n, int((onset + bd) * sr))
        if e <= s:
            continue
        tt = ta[s:e] - onset
        f0 = np.clip(140 * (A / 0.08) ** 0.6, 80, 400)
        env = np.minimum(1, tt / 0.015) * np.minimum(1, (bd - tt) / 0.06)
        amp = 0.3 * np.clip((A / 0.08) ** 0.5, 0.3, 2.0)
        y[s:e] += amp * env * (np.sin(2 * np.pi * f0 * tt) + 0.5 * np.sin(4 * np.pi * f0 * tt)
                               + 0.25 * np.sin(6 * np.pi * f0 * tt))
    y = np.clip(y, -1, 1).astype(np.float32)

    # movement pauses: >= 2 s with no stroke on either arm
    busy = np.zeros(T, bool)
    for t0, dur, _, _ in right + left:
        busy[(t >= t0) & (t < t0 + dur)] = True
    pauses = []
    run = 0
    for i in range(T):
        run = run + 1 if not busy[i] else 0
        if run == int(2.0 * fps):
            pauses.append(t[i] - 2.0)
    return {"landmarks": lm, "times": t, "audio": y, "sr": sr, "bursts": bursts, "pauses": pauses,
            "right": right, "left": left}


def simulate_viewer(rng, perf, duration, coupled=True, eda_delay=0.5):
    fine = np.arange(0, duration, 0.01)
    gain, lat = rng.uniform(0.5, 1.5), rng.uniform(-0.3, 0.3)
    # EDA (true signal on a fine grid)
    tonic = 2.0 + np.cumsum(rng.normal(0, 0.002, fine.size))
    phasic = np.zeros(fine.size)

    def add(arr, onset, amp, kernel):
        m = fine >= onset
        arr[m] += amp * kernel(fine[m] - onset)
    scr = lambda x: (1 - np.exp(-x / 0.7)) * np.exp(-x / 3.5) / 0.55
    for onset, A, large in perf["bursts"]:
        if large:
            when = onset + 2.0 + lat if coupled else rng.uniform(1, duration)
            add(phasic, when, gain * 0.3 * A / 0.08, scr)
    for ts in _events(rng, duration, 1 / 25, 2.0):
        add(phasic, ts, 0.2, scr)
    eda_true = tonic + phasic
    t_eda = np.arange(0, duration, 0.25)
    eda = np.interp(t_eda - eda_delay, fine, eda_true) + rng.normal(0, 0.01, t_eda.size)
    # pupil
    pup = 4.0 + 0.1 * np.sin(2 * np.pi * 0.02 * fine + rng.uniform(0, 6))
    gam = lambda x: (x / 0.9) ** 2 * np.exp(2 - 2 * x / 0.9)
    for onset, _, _ in perf["bursts"]:
        add(pup, onset if coupled else rng.uniform(1, duration), 0.15, gam)
    t_p = np.arange(0, duration, 1 / 30)
    pupil = np.interp(t_p, fine, pup) + rng.normal(0, 0.02, t_p.size)
    for tb in _events(rng, duration, 0.25, 0.5):
        pupil[(t_p >= tb) & (t_p < tb + 0.15)] = np.nan
    # respiration (independent) and heart rate
    rr = 0.25 + 0.03 * np.sin(2 * np.pi * 0.01 * fine + rng.uniform(0, 6))
    phase = 2 * np.pi * np.cumsum(rr) * 0.01
    resp = np.sin(phase)
    hr = 70 + rng.normal(0, 5) + 2.0 * np.sin(phase) + rng.normal(0, 0.3, fine.size)
    for p in perf["pauses"]:
        when = p + 3.0 if coupled else rng.uniform(1, duration)
        hr += -4.0 * np.exp(-0.5 * ((fine - when) / 1.0) ** 2)
    beats, tb = [], 0.3
    while tb < duration - 0.5:
        ibi = 60.0 / np.interp(tb, fine, hr)
        tb += ibi
        beats.append((tb, 1000 * ibi + rng.normal(0, 8)))
    t_r = np.arange(0, duration, 1 / 25)
    frames = [
        pd.DataFrame({"time_s": t_eda, "eda": eda, "synthetic": 1}),
        pd.DataFrame({"time_s": t_p, "pupil": pupil, "synthetic": 1}),
        pd.DataFrame({"time_s": t_r, "resp": np.interp(t_r, fine, resp) + rng.normal(0, 0.05, t_r.size), "synthetic": 1}),
        pd.DataFrame({"time_s": [b[0] for b in beats], "ibi_ms": [b[1] for b in beats], "synthetic": 1}),
    ]
    meta = {"eda": {"delay_s": eda_delay, "uncertainty": 0.01}, "pupil": {"uncertainty": 0.02},
            "ibi_ms": {"uncertainty": 8.0}, "resp": {"uncertainty": 0.05}}
    return frames, meta


def make_dataset(n_videos=10, n_viewers=3, duration=120.0, seed=0, coupled=True, rate=10.0,
                 test_viewers=None) -> "Dataset":
    rng = np.random.default_rng(seed)
    units = []
    vids = [f"synvideo{v:02d}" for v in range(n_videos)]
    viewers = [f"synviewer{w}" for w in range(n_viewers)]
    for vid in vids:
        perf = simulate_performer(rng, duration, coupled=coupled)
        vstreams = features_from_landmarks(perf["landmarks"], perf["times"], ASPECT)
        astreams = features_from_waveform(perf["audio"], perf["sr"])
        for w in viewers:
            frames, meta = simulate_viewer(rng, perf, duration, coupled=coupled)
            ps, pinfo, _ = physio_streams(frames, meta)
            units.append({"video": vid, "viewer": w, "video_streams": vstreams, "audio_streams": astreams,
                          "physio_streams": ps, "physio_info": pinfo, "duration": duration})
    if test_viewers is None and n_viewers >= 3:
        test_viewers = viewers[-1:]
    notes = ["SYNTHETIC DATA: generated by empc.synthetic with planted relationships. "
             "Results test the software only and are not evidence about human behaviour.",
             f"World: {'coupled (planted relationships present)' if coupled else 'NULL (no cross-modal relationships)'}; "
             f"{n_videos} videos x {n_viewers} viewers x {duration:.0f} s; seed {seed}."]
    ds = assemble(units, rate=rate, test_viewers=test_viewers, synthetic=True, notes=notes,
                  ground_truth=GROUND_TRUTH if coupled else [])
    ds.world = "planted" if coupled else "null"
    return ds


def render_demo_video(path: str, duration=40.0, seed=1, fps=30, size=(640, 480)) -> str:
    """Render a stick-figure video with synchronised sound bursts (mp4).

    Used to exercise the video+audio file pipeline end to end.  MediaPipe is
    not expected to detect a stick figure, so the optical-flow fallback is
    what normally runs on this file."""
    import os
    import shutil
    import subprocess
    import tempfile

    import cv2
    import soundfile as sf

    rng = np.random.default_rng(seed)
    perf = simulate_performer(rng, duration, fps=fps)  # write_demo_files relies on these exact draws
    W, H = size
    lm = perf["landmarks"]
    bones = [(11, 12), (11, 13), (13, 15), (12, 14), (14, 16), (11, 23), (12, 24), (23, 24)]
    with tempfile.TemporaryDirectory() as d:
        vtmp = os.path.join(d, "v.mp4")
        wtmp = os.path.join(d, "a.wav")
        vw = cv2.VideoWriter(vtmp, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
        for i in range(lm.shape[0]):
            img = np.full((H, W, 3), 235, np.uint8)
            P = lambda j: (int(lm[i, j, 0] * W), int(lm[i, j, 1] * H))
            for a, b in bones:
                cv2.line(img, P(a), P(b), (40, 40, 40), 10)
            cv2.circle(img, P(0), 38, (40, 40, 40), -1)
            for j in (15, 16):
                cv2.circle(img, P(j), 12, (20, 20, 160), -1)
            vw.write(img)
        vw.release()
        sf.write(wtmp, perf["audio"], perf["sr"])
        ff = shutil.which("ffmpeg")
        if ff:
            subprocess.run([ff, "-y", "-loglevel", "error", "-i", vtmp, "-i", wtmp, "-c:v", "copy",
                            "-c:a", "aac", "-shortest", path], check=True)
        else:  # no muxer available: keep silent video
            shutil.copy(vtmp, path)
    return path


def write_demo_files(out_dir: str, duration=90.0, seed=1) -> dict:
    """Write demo.mp4 plus matching SYNTHETIC physiology CSVs (different
    sampling rates, one with a recording delay) and a metadata JSON, to
    exercise the file-based pipeline exactly as a user would."""
    import json
    import os

    os.makedirs(out_dir, exist_ok=True)
    vpath = os.path.join(out_dir, "demo.mp4")
    render_demo_video(vpath, duration=duration, seed=seed)
    perf = simulate_performer(np.random.default_rng(seed), duration)  # same draws as the rendered video
    frames, meta = simulate_viewer(np.random.default_rng(seed + 1000), perf, duration)
    names = ["eda_4hz.csv", "pupil_30hz.csv", "resp_25hz.csv", "ibi_beats.csv"]
    paths = []
    for name, df in zip(names, frames):
        p = os.path.join(out_dir, name)
        df.to_csv(p, index=False)
        paths.append(p)
    mp = os.path.join(out_dir, "physio_meta.json")
    with open(mp, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=1)
    return {"video": vpath, "physio": paths, "meta": mp}
