"""Physiological channels from CSV files.

Accepted CSV layout: a ``time_s`` column plus any of the columns below.
Channels may live in separate files with different sampling rates; rows with
an empty cell simply mean "no sample at that time for that channel".

    hr       heart rate, beats per minute
    ibi_ms   inter-beat interval in ms, one row per detected beat
             (enables HRV, which is only reported where enough beats exist)
    eda      electrodermal activity, microsiemens
    resp     respiration waveform (any unit)
    pupil    pupil diameter (any unit; blinks as empty cells)
    gaze_x, gaze_y   gaze position (any unit)

A metadata JSON may give per-channel recording delays and measurement
uncertainty, e.g. ``{"eda": {"delay_s": 0.5, "uncertainty": 0.02}}``.
A column named ``synthetic`` (any truthy value) marks the file as synthetic.
"""
from __future__ import annotations

import json

import numpy as np
import pandas as pd
from scipy import signal as sps

from .signal_utils import interp_gaps, moving_average

CHANNEL_PREFIX = {
    "hr": "physio.hr", "ibi_ms": "physio.hr", "eda": "physio.eda", "resp": "physio.resp",
    "pupil": "physio.pupil", "gaze_x": "physio.gaze", "gaze_y": "physio.gaze",
}


def load_meta(path: str | None) -> dict:
    if not path:
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def read_physio_csv(path_or_df) -> pd.DataFrame:
    df = path_or_df if isinstance(path_or_df, pd.DataFrame) else pd.read_csv(path_or_df)
    df.columns = [c.strip().lower() for c in df.columns]
    if "time_s" not in df.columns:
        raise ValueError("Physiology CSV needs a 'time_s' column (seconds from video start).")
    return df


def _channel(df: pd.DataFrame, col: str) -> tuple[np.ndarray, np.ndarray]:
    sub = df[["time_s", col]].dropna()
    sub = sub.sort_values("time_s")
    return sub["time_s"].to_numpy(float), sub[col].to_numpy(float)


def physio_streams(frames: list[pd.DataFrame], meta: dict | None = None,
                   hrv_window_s: float = 10.0, min_beats: int = 8) -> tuple[dict, dict, bool]:
    """Return (streams, channel_info, synthetic_flag).  Delays are *not*
    applied here; they are returned in channel_info and applied by sync."""
    meta = meta or {}
    streams: dict[str, tuple[np.ndarray, np.ndarray]] = {}
    info: dict[str, dict] = {}
    synthetic = False
    for df in frames:
        if "synthetic" in df.columns and df["synthetic"].astype(bool).any():
            synthetic = True
        for col in df.columns:
            if col not in CHANNEL_PREFIX:
                continue
            t, v = _channel(df, col)
            if t.size < 3:
                continue
            m = meta.get(col, {})
            rate = 1.0 / np.median(np.diff(t))
            info[col] = {"native_rate_hz": float(rate), "delay_s": float(m.get("delay_s", 0.0)),
                         "uncertainty": m.get("uncertainty"), "samples": int(t.size)}
            if col == "hr":
                streams["physio.hr.bpm"] = (t, v)
            elif col == "ibi_ms":
                beat_t = t
                bpm = 60000.0 / np.clip(v, 250, 2500)
                streams.setdefault("physio.hr.bpm", (beat_t, bpm))
                # RMSSD in sliding windows; only where enough beats were measured
                centres = np.arange(beat_t[0] + hrv_window_s / 2, beat_t[-1] - hrv_window_s / 2, 1.0)
                rm = np.full(centres.size, np.nan)
                d = np.diff(v)
                dt = beat_t[1:]
                for i, c in enumerate(centres):
                    sel = (dt >= c - hrv_window_s / 2) & (dt < c + hrv_window_s / 2)
                    if sel.sum() >= min_beats - 1:
                        rm[i] = np.sqrt(np.mean(d[sel] ** 2))
                if np.isfinite(rm).sum() > 10:
                    streams["physio.hrv.rmssd"] = (centres, rm)
                    info["hrv"] = {"window_s": hrv_window_s, "min_beats": min_beats,
                                   "windows_valid": int(np.isfinite(rm).sum()), "delay_s": info[col]["delay_s"]}
            elif col == "eda":
                k = max(1, int(rate * 0.5))
                level = moving_average(v, k)
                base = moving_average(level, max(3, int(rate * 8)))
                streams["physio.eda.level"] = (t, level)
                streams["physio.eda.phasic"] = (t, level - base)
            elif col == "resp":
                vv = interp_gaps(v, int(rate))
                ok = np.isfinite(vv)
                if ok.sum() > rate * 10:
                    x = vv[ok] - np.mean(vv[ok])
                    b, a = sps.butter(2, [0.1 / (rate / 2), min(0.99, 1.0 / (rate / 2))], btype="band")
                    xf = sps.filtfilt(b, a, x)
                    peaks, _ = sps.find_peaks(xf, distance=max(1, int(rate * 1.5)))
                    tt = t[ok]
                    if peaks.size > 3:
                        pt = tt[peaks]
                        streams["physio.resp.rate"] = (pt[1:], 60.0 / np.diff(pt))
                    streams["physio.resp.signal"] = (tt, xf)
            elif col == "pupil":
                streams["physio.pupil.diameter"] = (t, interp_gaps(v, int(rate * 0.5)))
            elif col in ("gaze_x", "gaze_y"):
                streams[f"physio.gaze.{col[-1]}"] = (t, v)
    if "physio.gaze.x" in streams and "physio.gaze.y" in streams:
        tx, x = streams["physio.gaze.x"]
        ty, y = streams["physio.gaze.y"]
        if tx.size == ty.size and np.allclose(tx, ty):
            r = 1.0 / np.median(np.diff(tx))
            streams["physio.gaze.speed"] = (tx, np.hypot(np.gradient(x), np.gradient(y)) * r)
    return streams, info, synthetic


def delays_for_sync(info: dict) -> dict[str, float]:
    out = {}
    for col, d in info.items():
        if col in CHANNEL_PREFIX:
            out[CHANNEL_PREFIX[col]] = d.get("delay_s", 0.0)
        elif col == "hrv":
            out["physio.hrv"] = d.get("delay_s", 0.0)
    return out
