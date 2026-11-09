"""Integration-test video for the MediaPipe path: animates a public-domain
photograph of a person (NASA astronaut portrait shipped with scikit-image)
with known rigid motion (tilts and sways) and adds sound bursts that follow
each tilt by 0.3 s.

This is NOT real human movement: the body moves as a rigid picture.  It only
checks that pose detection, landmark normalisation, audio extraction and
discovery run end to end on a detectable human figure.

    python tools/make_photo_motion_video.py out.mp4 [duration_s]
"""
import os
import shutil
import subprocess
import sys
import tempfile

import cv2
import numpy as np
import soundfile as sf
from skimage import data


def main(path, duration=90.0, fps=30, seed=5):
    rng = np.random.default_rng(seed)
    img = cv2.cvtColor(data.astronaut(), cv2.COLOR_RGB2BGR)
    H, W = 576, 720
    T = int(duration * fps)
    t = np.arange(T) / fps
    angle = np.zeros(T)
    dx = 4 * np.sin(2 * np.pi * 0.07 * t)
    onsets = []
    s = 1.0
    while s < duration - 2:
        dur = rng.uniform(0.5, 1.0)
        amp = rng.uniform(4, 10) * rng.choice([-1, 1])
        m = (t >= s) & (t < s + dur)
        angle[m] += amp * np.sin(np.pi * (t[m] - s) / dur) ** 2
        if rng.random() < 0.8:
            onsets.append(s + dur / 2 + 0.3)
        s += dur + rng.exponential(2.0) + 0.5
    sr = 16000
    ta = np.arange(int(duration * sr)) / sr
    y = rng.normal(0, 0.002, ta.size)
    for o in onsets:
        bd = rng.uniform(0.25, 0.45)
        m = (ta >= o) & (ta < o + bd)
        tt = ta[m] - o
        f0 = rng.uniform(120, 240)
        env = np.minimum(1, tt / 0.015) * np.minimum(1, (bd - tt) / 0.06)
        y[m] += 0.3 * env * (np.sin(2 * np.pi * f0 * tt) + 0.4 * np.sin(4 * np.pi * f0 * tt))
    with tempfile.TemporaryDirectory() as d:
        vt, wt = os.path.join(d, "v.mp4"), os.path.join(d, "a.wav")
        vw = cv2.VideoWriter(vt, cv2.VideoWriter_fourcc(*"mp4v"), fps, (W, H))
        for i in range(T):
            M = cv2.getRotationMatrix2D((256, 400), angle[i], 1.0)
            M[0, 2] += (W - 512) / 2 + dx[i]
            M[1, 2] += (H - 512) / 2
            vw.write(cv2.warpAffine(img, M, (W, H), borderValue=(200, 200, 200)))
        vw.release()
        sf.write(wt, np.clip(y, -1, 1).astype(np.float32), sr)
        subprocess.run([shutil.which("ffmpeg"), "-y", "-loglevel", "error", "-i", vt, "-i", wt,
                        "-c:v", "copy", "-c:a", "aac", "-shortest", path], check=True)
    print("wrote", path, "with", len(onsets), "sound bursts")


if __name__ == "__main__":
    main(sys.argv[1], float(sys.argv[2]) if len(sys.argv) > 2 else 90.0)
