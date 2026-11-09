"""Acoustic gesture features from audio (no speech transcription).

Every feature is a time-varying number at a 10 ms hop: energy envelope,
its derivative, onsets, silence, spectral shape, pitch (fundamental
frequency, in semitones re 100 Hz), and local rhythmic periodicity.
"""
from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

import numpy as np

from .signal_utils import interp_gaps, rolling_periodicity, savgol_deriv

HOP_S = 0.01


def extract_audio_track(video_path: str, sr: int = 16000) -> tuple[np.ndarray, int]:
    """Decode the audio track of a video file with ffmpeg (mono, ``sr`` Hz)."""
    import soundfile as sf

    ff = shutil.which("ffmpeg")
    if ff is None:
        try:
            import imageio_ffmpeg  # optional

            ff = imageio_ffmpeg.get_ffmpeg_exe()
        except Exception as exc:  # pragma: no cover
            raise RuntimeError("ffmpeg is needed to read audio from video files. "
                               "Install it, or pip install imageio-ffmpeg.") from exc
    with tempfile.TemporaryDirectory() as d:
        wav = Path(d) / "a.wav"
        cmd = [ff, "-y", "-loglevel", "error", "-i", str(video_path), "-vn", "-ac", "1",
               "-ar", str(sr), str(wav)]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode != 0 or not wav.exists():
            raise RuntimeError(f"No audio track could be decoded: {r.stderr.strip()[:300]}")
        y, sr = sf.read(str(wav), dtype="float32")
    return y, sr


def features_from_waveform(y: np.ndarray, sr: int, pitch_method: str = "yin",
                           fmin: float = 70.0, fmax: float = 500.0) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    import librosa

    y = np.asarray(y, dtype=np.float32)
    if y.ndim > 1:
        y = y.mean(axis=1)
    hop = int(round(HOP_S * sr))
    nfft = 1024 if sr <= 22050 else 2048
    fs = sr / hop
    rms = librosa.feature.rms(y=y, frame_length=nfft, hop_length=hop, center=True)[0]
    rms_db = 20 * np.log10(np.maximum(rms, 1e-6))
    n = rms.size
    t = np.arange(n) * hop / sr
    S = np.abs(librosa.stft(y, n_fft=nfft, hop_length=hop, center=True))[:, :n]
    onset = librosa.onset.onset_strength(S=librosa.amplitude_to_db(S, ref=np.max), sr=sr, hop_length=hop)[:n]
    centroid = librosa.feature.spectral_centroid(S=S, sr=sr)[0][:n]
    flatness = librosa.feature.spectral_flatness(S=S)[0][:n]
    zcr = librosa.feature.zero_crossing_rate(y, frame_length=nfft, hop_length=hop)[0][:n]
    Sn = S / (S.sum(axis=0, keepdims=True) + 1e-12)
    flux = np.concatenate([[0.0], np.sqrt((np.maximum(np.diff(Sn, axis=1), 0) ** 2).sum(axis=0))])

    ref = np.percentile(rms_db, 95)
    silent = rms_db < ref - 35.0

    if pitch_method == "pyin":
        f0, voiced, _ = librosa.pyin(y, fmin=fmin, fmax=fmax, sr=sr, frame_length=nfft * 2, hop_length=hop)
        f0 = f0[:n]
        voiced = np.asarray(voiced[:n], bool)
    else:
        f0 = librosa.yin(y, fmin=fmin, fmax=fmax, sr=sr, frame_length=nfft * 2, hop_length=hop)[:n]
        st = 12 * np.log2(np.maximum(f0, 1e-3) / 100.0)
        stable = np.abs(np.gradient(st)) < 1.0
        voiced = (~silent[:f0.size]) & stable & (rms_db[:f0.size] > ref - 25.0)
    f0 = np.where(voiced, f0, np.nan)
    f0_st = 12 * np.log2(f0 / 100.0)
    f0_st = interp_gaps(f0_st, int(0.3 * fs))
    if f0_st.size < n:
        f0_st = np.pad(f0_st, (0, n - f0_st.size), constant_values=np.nan)
        voiced = np.pad(voiced, (0, n - voiced.size))

    per, per_s = rolling_periodicity(onset, fs, window_s=4.0, min_period_s=0.2, max_period_s=2.0)
    feats = {
        "audio.energy.rms_db": rms_db,
        "audio.energy.d_rms": savgol_deriv(rms_db, fs, window_s=0.1),
        "audio.timing.onset": onset,
        "audio.timing.silence": silent.astype(float),
        "audio.timing.periodicity": per,
        "audio.spectral.centroid_log": np.log2(np.maximum(centroid, 1.0)),
        "audio.spectral.flux": flux,
        "audio.spectral.flatness": np.log10(np.maximum(flatness, 1e-6)),
        "audio.spectral.zcr": zcr,
        "audio.pitch.f0_st": f0_st,
        "audio.pitch.d_f0": savgol_deriv(f0_st, fs, window_s=0.1),
        "audio.pitch.voiced": voiced[:n].astype(float),
    }
    return {k: (t, np.asarray(v, float)[:n]) for k, v in feats.items()}
