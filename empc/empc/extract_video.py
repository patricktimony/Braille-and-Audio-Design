"""Movement features from video.

Primary path: MediaPipe Pose (plus optional Face and Hand landmarkers) run
locally on CPU.  Fallback path when MediaPipe or its model files are missing:
dense optical flow (OpenCV Farneback), which gives motion energy but no body
parts.

Depth caveat: MediaPipe's z coordinate is a *monocular estimate* relative to
the hips, not a measured depth.  Every feature derived from it carries the
suffix ``_est`` and should be treated as low-confidence.

All features are mathematical (positions, velocities, accelerations,
periodicities); none are verbal descriptions or emotion labels.
"""
from __future__ import annotations

import os
from pathlib import Path

import numpy as np

from .signal_utils import interp_gaps, moving_average, rolling_corr, rolling_periodicity, savgol_deriv

# MediaPipe Pose landmark indices (subject's left/right as reported by the model)
POSE_POINTS = {"head": 0, "wrist_l": 15, "wrist_r": 16, "elbow_l": 13, "elbow_r": 14}
SHOULDER_L, SHOULDER_R = 11, 12

MODEL_URLS = {
    "pose_landmarker_lite.task": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task",
    "face_landmarker.task": "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task",
    "hand_landmarker.task": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
}


def model_dir() -> Path:
    return Path(os.environ.get("EMPC_MODEL_DIR", Path.home() / ".empc" / "models"))


def download_models(names=None) -> list[str]:
    """Download MediaPipe model files once (free; afterwards fully offline)."""
    import urllib.request

    d = model_dir()
    d.mkdir(parents=True, exist_ok=True)
    done = []
    for name, url in MODEL_URLS.items():
        if names and name not in names:
            continue
        p = d / name
        if not p.exists():
            urllib.request.urlretrieve(url, p)
        done.append(str(p))
    return done


# --------------------------------------------------------------------------
# Landmark arrays -> features (pure NumPy; also used by the synthetic generator)
# --------------------------------------------------------------------------

def features_from_landmarks(lm: np.ndarray, times: np.ndarray, aspect: float = 1.0,
                            min_visibility: float = 0.5) -> dict[str, tuple[np.ndarray, np.ndarray]]:
    """lm: (T, 33, 4) array of x, y, z, visibility in MediaPipe normalised
    image coordinates (x right, y down).  times: (T,) seconds.

    Normalisation: x and z are multiplied by the frame aspect ratio (width /
    height) so units are isotropic; coordinates are centred on the mid-point
    of the shoulders and divided by the median shoulder width, so values are
    in "shoulder widths" and roughly independent of body size and camera
    distance.  Velocities are per second, so frame rate cancels out.
    """
    lm = np.asarray(lm, dtype=float).copy()
    times = np.asarray(times, float)
    T = lm.shape[0]
    fs = 1.0 / np.median(np.diff(times)) if T > 1 else 30.0
    vis = lm[:, :, 3]
    xyz = lm[:, :, :3].copy()
    xyz[:, :, 0] *= aspect
    xyz[:, :, 2] *= aspect
    xyz[:, :, 1] *= -1.0  # y up
    xyz[vis < min_visibility] = np.nan
    gap = int(0.5 * fs)
    for j in range(xyz.shape[1]):
        for c in range(3):
            xyz[:, j, c] = interp_gaps(xyz[:, j, c], gap)

    centre = 0.5 * (xyz[:, SHOULDER_L, :] + xyz[:, SHOULDER_R, :])
    sw = np.linalg.norm(xyz[:, SHOULDER_L, :2] - xyz[:, SHOULDER_R, :2], axis=1)
    scale = np.nanmedian(sw) if np.isfinite(sw).any() else np.nan
    if not np.isfinite(scale) or scale < 1e-6:
        return {}
    rel = (xyz - centre[:, None, :]) / scale

    out: dict[str, np.ndarray] = {}
    speeds = {}
    for name, j in POSE_POINTS.items():
        x, y, z = rel[:, j, 0], rel[:, j, 1], rel[:, j, 2]
        vx, vy, vz = savgol_deriv(x, fs), savgol_deriv(y, fs), savgol_deriv(z, fs)
        ax, ay = savgol_deriv(x, fs, deriv=2), savgol_deriv(y, fs, deriv=2)
        speed = np.hypot(vx, vy)
        speeds[name] = speed
        out[f"video.{name}.x"] = x
        out[f"video.{name}.y"] = y
        out[f"video.{name}.z_est"] = z
        out[f"video.{name}.vy"] = vy
        out[f"video.{name}.speed"] = speed
        out[f"video.{name}.accel"] = np.hypot(ax, ay)
        out[f"video.{name}.z_speed_est"] = np.abs(vz)
    energy = sum(speeds[k] ** 2 for k in ("wrist_l", "wrist_r", "elbow_l", "elbow_r", "head"))
    out["video.body.energy"] = np.sqrt(energy)
    hand_speed = speeds["wrist_l"] + speeds["wrist_r"]
    out["video.body.stillness"] = (moving_average(hand_speed, max(1, int(0.5 * fs))) < 0.25).astype(float)
    out["video.body.stillness"][~np.isfinite(hand_speed)] = np.nan
    st, pe = rolling_periodicity(out["video.body.energy"], fs)
    out["video.body.periodicity"] = st
    out["video.body.period_s"] = pe
    st, pe = rolling_periodicity(rel[:, POSE_POINTS["head"], 1], fs, min_period_s=0.2, max_period_s=1.5)
    out["video.head.periodicity"] = st
    out["video.hands.distance"] = np.linalg.norm(rel[:, 15, :2] - rel[:, 16, :2], axis=1)
    out["video.hands.speed_sync"] = rolling_corr(speeds["wrist_l"], speeds["wrist_r"], max(3, int(2 * fs)))
    out["video.tracking.visible_frac"] = np.mean(vis >= min_visibility, axis=1)
    return {k: (times, v) for k, v in out.items()}


def face_features(face_lm: np.ndarray, times: np.ndarray, aspect: float) -> dict:
    """face_lm: (T, 478, 3) FaceLandmarker points (NaN where no face).
    Purely geometric distances normalised by face width."""
    p = np.asarray(face_lm, float).copy()
    p[:, :, 0] *= aspect
    fs = 1.0 / np.median(np.diff(times)) if len(times) > 1 else 30.0

    def d(a, b):
        return np.linalg.norm(p[:, a, :2] - p[:, b, :2], axis=1)

    fw = d(234, 454)
    fw = np.where(fw > 1e-6, fw, np.nan)
    feats = {
        "video.face.mouth_aperture": d(13, 14) / fw,
        "video.face.mouth_width": d(61, 291) / fw,
        "video.face.eye_aperture_l": d(386, 374) / fw,
        "video.face.eye_aperture_r": d(159, 145) / fw,
        "video.face.brow_eye_l": d(334, 386) / fw,
        "video.face.brow_eye_r": d(105, 159) / fw,
        "video.face.yaw_proxy": (p[:, 1, 0] - 0.5 * (p[:, 234, 0] + p[:, 454, 0])) / fw,
        "video.face.pitch_proxy": (p[:, 1, 1] - 0.5 * (p[:, 159, 1] + p[:, 386, 1])) / fw,
    }
    feats["video.face.mouth_speed"] = np.abs(savgol_deriv(feats["video.face.mouth_aperture"], fs))
    return {k: (times, interp_gaps(v, int(0.5 * fs))) for k, v in feats.items()}


def hand_features(hand_lm: dict[str, np.ndarray], times: np.ndarray, aspect: float) -> dict:
    """hand_lm: side -> (T, 21, 3).  Side labels come from the model's
    handedness classifier, which can confuse mirrored video; treat with care."""
    out = {}
    fs = 1.0 / np.median(np.diff(times)) if len(times) > 1 else 30.0
    for side, p in hand_lm.items():
        p = np.asarray(p, float).copy()
        p[:, :, 0] *= aspect
        palm = np.linalg.norm(p[:, 0, :2] - p[:, 9, :2], axis=1)
        palm = np.where(palm > 1e-6, palm, np.nan)
        aperture = np.linalg.norm(p[:, 4, :2] - p[:, 8, :2], axis=1) / palm
        centre = p[:, [0, 5, 9, 13, 17], :2].mean(axis=1)
        spread = np.mean([np.linalg.norm(p[:, t, :2] - centre, axis=1) for t in (4, 8, 12, 16, 20)], axis=0) / palm
        out[f"video.hand_{side}.aperture"] = aperture
        out[f"video.hand_{side}.spread"] = spread
        out[f"video.hand_{side}.aperture_speed"] = np.abs(savgol_deriv(aperture, fs))
    return {k: (times, interp_gaps(v, int(0.5 * fs))) for k, v in out.items()}


# --------------------------------------------------------------------------
# Video file -> features
# --------------------------------------------------------------------------

def _mediapipe_available() -> bool:
    try:
        import mediapipe  # noqa: F401
        from mediapipe.tasks.python import vision  # noqa: F401
    except Exception:
        return False
    return (model_dir() / "pose_landmarker_lite.task").exists()


def extract_video_features(path: str, max_fps: float = 15.0, method: str = "auto",
                           progress=None) -> tuple[dict, dict]:
    """Return (streams, info).  streams: name -> (times, values)."""
    import cv2

    cap = cv2.VideoCapture(str(path))
    if not cap.isOpened():
        raise IOError(f"Cannot open video: {path}")
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    nframes = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    step = max(1, int(round(fps / max_fps)))
    aspect = w / h if h else 1.0
    use_mp = method == "mediapipe" or (method == "auto" and _mediapipe_available())
    info = {"fps": fps, "frames": nframes, "width": w, "height": h, "frame_step": step,
            "method": "mediapipe" if use_mp else "optical_flow"}
    if use_mp:
        try:
            streams = _mediapipe_pass(cap, fps, step, aspect, info, progress)
        except (OSError, RuntimeError) as exc:  # e.g. missing GPU/EGL libraries on a headless machine
            info["mediapipe_error"] = str(exc)[:200]
            streams = {}
        if not streams:  # nobody detected, or MediaPipe could not start
            cap.release()
            cap = cv2.VideoCapture(str(path))
            info["method"] = ("optical_flow (MediaPipe could not start: " + info["mediapipe_error"] + ")"
                              if "mediapipe_error" in info else "optical_flow (no person detected by MediaPipe)")
            streams = _flow_pass(cap, fps, step, info, progress)
    else:
        streams = _flow_pass(cap, fps, step, info, progress)
    cap.release()
    return streams, info


def _mediapipe_pass(cap, fps, step, aspect, info, progress):
    import cv2
    import mediapipe as mp
    from mediapipe.tasks import python as mpt
    from mediapipe.tasks.python import vision

    md = model_dir()
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(
        base_options=mpt.BaseOptions(model_asset_path=str(md / "pose_landmarker_lite.task")),
        running_mode=vision.RunningMode.VIDEO, num_poses=1))
    face = hand = None
    if (md / "face_landmarker.task").exists():
        face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(
            base_options=mpt.BaseOptions(model_asset_path=str(md / "face_landmarker.task")),
            running_mode=vision.RunningMode.VIDEO, num_faces=1))
    if (md / "hand_landmarker.task").exists():
        hand = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(
            base_options=mpt.BaseOptions(model_asset_path=str(md / "hand_landmarker.task")),
            running_mode=vision.RunningMode.VIDEO, num_hands=2))
    times, pose_rows, face_rows = [], [], []
    hand_rows = {"l": [], "r": []}
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            t = i / fps
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            img = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            ts = int(t * 1000)
            r = pose.detect_for_video(img, ts)
            row = np.full((33, 4), np.nan)
            if r.pose_landmarks:
                row = np.array([[p.x, p.y, p.z, p.visibility if p.visibility is not None else 1.0]
                                for p in r.pose_landmarks[0]])
            pose_rows.append(row)
            if face is not None:
                fr = face.detect_for_video(img, ts)
                frow = np.full((478, 3), np.nan)
                if fr.face_landmarks:
                    pts = np.array([[p.x, p.y, p.z] for p in fr.face_landmarks[0]])
                    frow[:len(pts)] = pts[:478]
                face_rows.append(frow)
            if hand is not None:
                hr = hand.detect_for_video(img, ts)
                got = {"l": np.full((21, 3), np.nan), "r": np.full((21, 3), np.nan)}
                for lmks, hd in zip(hr.hand_landmarks or [], hr.handedness or []):
                    side = "l" if hd[0].category_name.lower().startswith("l") else "r"
                    got[side] = np.array([[p.x, p.y, p.z] for p in lmks])
                for s in ("l", "r"):
                    hand_rows[s].append(got[s])
            times.append(t)
            if progress and len(times) % 50 == 0:
                progress(i, info["frames"])
        i += 1
    pose.close()
    if face is not None:
        face.close()
    if hand is not None:
        hand.close()
    times = np.array(times)
    lm = np.array(pose_rows) if pose_rows else np.zeros((0, 33, 4))
    detected = np.isfinite(lm[:, 0, 0]).mean() if len(lm) else 0.0
    info["pose_detected_frac"] = float(detected)
    if detected < 0.2:
        return {}
    streams = features_from_landmarks(lm, times, aspect)
    if face_rows:
        f = np.array(face_rows)
        info["face_detected_frac"] = float(np.isfinite(f[:, 0, 0]).mean())
        if info["face_detected_frac"] > 0.2:
            streams.update(face_features(f, times, aspect))
    if hand is not None:
        streams.update(hand_features({s: np.array(v) for s, v in hand_rows.items()}, times, aspect))
    return streams


def _flow_pass(cap, fps, step, info, progress):
    """Optical-flow motion energy: global and on a 3x3 grid (not body-specific)."""
    import cv2

    prev = None
    times, energy, cx, cy, grid = [], [], [], [], []
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i % step == 0:
            g = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            scale = 160.0 / max(g.shape)
            g = cv2.resize(g, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
            if prev is not None:
                flow = cv2.calcOpticalFlowFarneback(prev, g, None, 0.5, 3, 15, 3, 5, 1.2, 0)
                mag = np.hypot(flow[..., 0], flow[..., 1]) * (fps / step) / g.shape[1]
                tot = mag.sum() + 1e-12
                yy, xx = np.mgrid[0:g.shape[0], 0:g.shape[1]]
                times.append(i / fps)
                energy.append(mag.mean())
                cx.append((mag * xx).sum() / tot / g.shape[1])
                cy.append(1 - (mag * yy).sum() / tot / g.shape[0])
                hh, ww = g.shape[0] // 3, g.shape[1] // 3
                grid.append([mag[r * hh:(r + 1) * hh, c * ww:(c + 1) * ww].mean() for r in range(3) for c in range(3)])
            prev = g
            if progress and len(times) % 50 == 0:
                progress(i, info["frames"])
        i += 1
    times = np.array(times)
    if times.size < 10:
        return {}
    fs = 1.0 / np.median(np.diff(times))
    e = np.array(energy)
    streams = {
        "video.flow.energy": e,
        "video.flow.d_energy": savgol_deriv(e, fs),
        "video.flow.cx": np.array(cx),
        "video.flow.cy": np.array(cy),
    }
    st, pe = rolling_periodicity(e, fs)
    streams["video.flow.periodicity"] = st
    gridarr = np.array(grid)
    for k in range(9):
        streams[f"video.flowgrid.g{k // 3}{k % 3}"] = gridarr[:, k]
    return {k: (times, v) for k, v in streams.items()}
