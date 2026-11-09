"""Command-line interface (screen-reader friendly: plain text output only).

Examples
  python -m empc synthetic --out results/synthetic
  python -m empc synthetic --null-world --out results/null
  python -m empc video clip.mp4 --physio hr.csv eda.csv --physio-meta meta.json --out results/clip
  python -m empc demo-files demo
  python -m empc models
  python -m empc app
"""
from __future__ import annotations

import argparse
import os
import sys


def _cfg(a):
    from .discovery import SearchConfig
    from .pipeline import ExperimentConfig

    sc = SearchConfig(n_surrogates=a.surrogates, n_val_surrogates=a.val_surrogates)
    if a.quick:
        return ExperimentConfig(search=sc, stability_runs=1, evolve_budget=100, evolve_seeds=(0,),
                                evolve_targets=1, max_patterns=12, primary=a.strategy, seed=a.seed,
                                compare=tuple(a.compare))
    return ExperimentConfig(search=sc, stability_runs=a.stability, primary=a.strategy, seed=a.seed,
                            compare=tuple(a.compare))


def _finish(res, out):
    from .report import write_report

    files = write_report(res, out)
    print()
    print(open(files["summary.txt"], encoding="utf-8").read())
    print("Files written:")
    for k, v in files.items():
        print("  ", v)
    return 0


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="empc", description="Evolutionary Multimodal Pattern Compression (research prototype)")
    sub = p.add_subparsers(dest="cmd", required=True)

    def common(sp):
        sp.add_argument("--out", default="results/run", help="output folder")
        sp.add_argument("--strategy", default="adaptive", choices=["adaptive", "staged", "exhaustive"])
        sp.add_argument("--compare", nargs="*", default=["exhaustive", "staged", "adaptive"],
                        help="search strategies to run for the compute comparison")
        sp.add_argument("--surrogates", type=int, default=999)
        sp.add_argument("--val-surrogates", type=int, default=99)
        sp.add_argument("--stability", type=int, default=5, help="number of resampling runs")
        sp.add_argument("--seed", type=int, default=0)
        sp.add_argument("--quick", action="store_true", help="smaller budgets for a fast look")

    s = sub.add_parser("synthetic", help="run the experiment on labelled synthetic data")
    common(s)
    s.add_argument("--videos", type=int, default=10)
    s.add_argument("--viewers", type=int, default=3)
    s.add_argument("--duration", type=float, default=120.0)
    s.add_argument("--data-seed", type=int, default=0)
    s.add_argument("--null-world", action="store_true", help="remove every planted relationship")

    v = sub.add_parser("video", help="run on one or more real video files")
    common(v)
    v.add_argument("videos", nargs="+")
    v.add_argument("--physio", nargs="*", default=[], help="physiology CSV file(s) (applied to every video "
                   "unless --physio-per-video is given)")
    v.add_argument("--physio-per-video", action="store_true",
                   help="treat --physio files as one per video, in the same order")
    v.add_argument("--physio-meta", default=None, help="JSON with per-channel delay_s and uncertainty")
    v.add_argument("--viewer", default="viewer1")
    v.add_argument("--max-fps", type=float, default=15.0)
    v.add_argument("--video-method", default="auto", choices=["auto", "mediapipe", "optical_flow"])
    v.add_argument("--pitch", default="yin", choices=["yin", "pyin"])

    d = sub.add_parser("demo-files", help="write a synthetic stick-figure video with sound plus matching "
                       "SYNTHETIC physiology CSVs and metadata into a folder")
    d.add_argument("path")
    d.add_argument("--duration", type=float, default=60.0)
    d.add_argument("--seed", type=int, default=1)

    sub.add_parser("models", help="download MediaPipe model files (one-time, then offline)")
    sub.add_parser("app", help="start the accessible Streamlit interface")

    a = p.parse_args(argv)
    if a.cmd == "synthetic":
        from .pipeline import run_experiment
        from .synthetic import make_dataset

        print(f"Generating synthetic data ({'null world' if a.null_world else 'planted relationships'}) ...")
        ds = make_dataset(a.videos, a.viewers, a.duration, seed=a.data_seed, coupled=not a.null_world)
        res = run_experiment(ds, _cfg(a))
        return _finish(res, a.out)
    if a.cmd == "video":
        from .ingest import assemble, load_video_unit
        from .pipeline import run_experiment

        units = []
        for i, vp in enumerate(a.videos):
            phys = [a.physio[i]] if a.physio_per_video and i < len(a.physio) else (None if a.physio_per_video else a.physio)
            print(f"Extracting features from {vp} ...")
            u = load_video_unit(vp, phys, a.physio_meta, viewer=a.viewer, max_fps=a.max_fps,
                                video_method=a.video_method, pitch_method=a.pitch,
                                progress=lambda i, n: print(f"  frame {i} of {n}", flush=True))
            print(f"  video method: {u['video_info']['method']}; {len(u['video_streams'])} movement, "
                  f"{len(u['audio_streams'])} sound, {len(u['physio_streams'])} physiological signals; "
                  f"{u['duration']:.1f} s")
            units.append(u)
        syn = any(u["physio_synthetic"] for u in units)
        notes = [f"Video feature method: {u['video_info']['method']} for {u['video']}" for u in units]
        if syn:
            notes.insert(0, "SYNTHETIC physiology was supplied (file marked synthetic): physiological results are NOT evidence.")
        ds = assemble(units, synthetic=syn, notes=notes)
        res = run_experiment(ds, _cfg(a))
        return _finish(res, a.out)
    if a.cmd == "demo-files":
        from .synthetic import write_demo_files

        f = write_demo_files(a.path, duration=a.duration, seed=a.seed)
        print("Video:", f["video"])
        for p_ in f["physio"]:
            print("Physiology (synthetic):", p_)
        print("Metadata:", f["meta"])
        print(f"Next: python -m empc video {f['video']} --physio {' '.join(f['physio'])} --physio-meta {f['meta']}")
        return 0
    if a.cmd == "models":
        from .extract_video import download_models

        for f in download_models():
            print("Model ready:", f)
        return 0
    if a.cmd == "app":
        import subprocess

        app = os.path.join(os.path.dirname(__file__), "app.py")
        return subprocess.call([sys.executable, "-m", "streamlit", "run", app])
    return 1
