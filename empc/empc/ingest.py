"""Turn recordings (video files, audio, physiology CSVs) into a Dataset."""
from __future__ import annotations

import math
from pathlib import Path

import numpy as np

from .data import Dataset, Segment
from .extract_audio import extract_audio_track, features_from_waveform
from .extract_video import extract_video_features
from .physio import delays_for_sync, load_meta, physio_streams, read_physio_csv
from .sync import build_frame


def load_video_unit(video_path: str, physio_csvs: list[str] | None = None, meta_path: str | None = None,
                    viewer: str = "viewer1", max_fps: float = 15.0, video_method: str = "auto",
                    pitch_method: str = "yin", progress=None) -> dict:
    vstreams, vinfo = extract_video_features(video_path, max_fps=max_fps, method=video_method, progress=progress)
    try:
        y, sr = extract_audio_track(video_path)
        astreams = features_from_waveform(y, sr, pitch_method=pitch_method)
        ainfo = {"sample_rate": sr, "duration_s": len(y) / sr}
    except RuntimeError as exc:
        astreams, ainfo = {}, {"error": str(exc)}
    pstreams, pinfo, psyn = {}, {}, False
    if physio_csvs:
        pstreams, pinfo, psyn = physio_streams([read_physio_csv(p) for p in physio_csvs], load_meta(meta_path))
    durations = [v[0][-1] for v in vstreams.values() if len(v[0])] + [v[0][-1] for v in astreams.values() if len(v[0])]
    return {"video": Path(video_path).stem, "viewer": viewer, "video_streams": vstreams,
            "audio_streams": astreams, "physio_streams": pstreams, "physio_info": pinfo,
            "physio_synthetic": psyn, "duration": float(min(durations)) if durations else 0.0,
            "video_info": vinfo, "audio_info": ainfo}


def assemble(units: list[dict], rate: float = 10.0, test_videos: list[str] | None = None,
             test_viewers: list[str] | None = None, synthetic: bool = False,
             notes: list[str] | None = None, ground_truth: list[dict] | None = None,
             time_split: float = 0.65, gap_s: float = 5.0) -> Dataset:
    notes = list(notes or [])
    videos = []
    for u in units:
        if u["video"] not in videos:
            videos.append(u["video"])
    viewers = sorted({u["viewer"] for u in units})
    use_time_split = len(videos) < 3
    if not use_time_split and test_videos is None:
        k = max(1, math.ceil(0.3 * len(videos)))
        test_videos = videos[-k:]
    test_videos = set(test_videos or [])
    test_viewers = set(test_viewers or [])
    if use_time_split:
        notes.append(f"Fewer than 3 videos: each recording is split in time; the first {time_split:.0%} "
                     f"trains, the rest (after a {gap_s:.0f} s gap) is held out for testing. "
                     "Held-out data then comes from the same person and session, so generalisation "
                     "to new people or recordings is NOT tested.")
    else:
        notes.append(f"Held-out test videos: {', '.join(sorted(test_videos))}"
                     + (f"; held-out viewers: {', '.join(sorted(test_viewers))}" if test_viewers else ""))
    performer, viewer_segs = [], []
    channel_meta = {}
    done_videos = set()
    for u in units:
        dur = u["duration"]
        av = {**u["video_streams"], **u["audio_streams"]}
        delays = delays_for_sync(u["physio_info"])
        channel_meta.update({k: v for k, v in u["physio_info"].items()})
        frames = []
        if u["video"] not in done_videos:
            frames.append(("performer", build_frame(av, dur, rate), u["video"]))
            done_videos.add(u["video"])
        if u["physio_streams"]:
            pf = build_frame({**av, **u["physio_streams"]}, dur, rate, delays=delays)
            frames.append(("viewer", pf, f"{u['video']}|{u['viewer']}"))
        for view, frame, unit in frames:
            if use_time_split:
                n = len(frame)
                cut = int(time_split * n)
                g = int(gap_s * rate)
                parts = [("train", frame.iloc[:cut]), ("test", frame.iloc[cut + g:])]
            else:
                is_test = u["video"] in test_videos or (view == "viewer" and u["viewer"] in test_viewers)
                parts = [("test" if is_test else "train", frame)]
            for role, fr in parts:
                seg = Segment(unit=f"{unit}#{role}" if use_time_split else unit, role=role, frame=fr,
                              rate=rate, video=u["video"], viewer=u["viewer"] if view == "viewer" else "")
                (performer if view == "performer" else viewer_segs).append(seg)
    return Dataset(performer=performer, viewer=viewer_segs, rate=rate, synthetic=synthetic,
                   notes=notes, ground_truth=ground_truth or [], channel_meta=channel_meta)
