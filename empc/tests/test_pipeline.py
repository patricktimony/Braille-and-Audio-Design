import os
import re

import numpy as np
import pandas as pd

from empc.compression import fit_ladder, select_minimal
from empc.data import Segment
from empc.discovery import SearchConfig
from empc.pipeline import run_experiment
from empc.report import write_report
from empc.store import FeatureStore

SEMANTIC = re.compile(r"\b(happ\w*|sad\w*|fear\w*|anger|angry|surpris\w*|disgust\w*|joy\w*|emotion\w*)\b", re.I)


def test_ladder_prefers_compact_model_for_single_lag_relation():
    rng = np.random.default_rng(0)
    segs = []
    for i in range(3):
        x = np.convolve(rng.normal(size=1500), np.ones(5) / 5, mode="same")
        y = 0.8 * np.roll(x, 6) + 0.3 * rng.normal(size=1500)
        segs.append(Segment(f"u{i}", "train", pd.DataFrame({"audio.a.x": x, "physio.b.y": y}), 10.0))
    ms, base = fit_ladder(FeatureStore(segs), "audio.a.x", "physio.b.y", 0.0, 6, SearchConfig(), rng)
    chosen, sel = select_minimal(ms, rng)
    assert chosen.kind in ("M1", "M2") and chosen.params <= 10
    assert chosen.val["gain"] > 0.3


def test_pipeline_end_to_end_and_report(small_world, fast_cfg, tmp_path):
    res = run_experiment(small_world, fast_cfg, log=lambda *a: None)
    gen = [p for p in res["patterns"] if p["generalizes"]]
    assert gen, "planted relationships should generalise"
    gt = {r["id"]: r for r in res["ground_truth"]["relations"]}
    assert gt["GT1"]["found_generalized"]
    assert not res["ground_truth"]["false_positive_patterns_generalized"]
    files = write_report(res, str(tmp_path))
    for f in ("report.html", "report.md", "summary.txt", "patterns.csv", "search_comparison.csv"):
        assert os.path.exists(files[f])
    html = open(files["report.html"], encoding="utf-8").read()
    assert '<html lang="en">' in html and "<caption>" in html and 'scope="col"' in html
    assert "SYNTHETIC" in open(files["summary.txt"], encoding="utf-8").read()
    pats = pd.read_csv(files["patterns.csv"])
    assert pats["pattern"].str.match(r"P\d{3}").all()
    # no emotion vocabulary anywhere in the generated outputs
    for f in ("report.md", "summary.txt", "patterns.csv"):
        assert not SEMANTIC.search(open(files[f], encoding="utf-8").read()), f


def test_null_world_reports_negative_result(null_world, fast_cfg, tmp_path):
    res = run_experiment(null_world, fast_cfg, log=lambda *a: None)
    assert len(res["ground_truth"]["false_positive_patterns_generalized"]) <= 1
    files = write_report(res, str(tmp_path))
    s = open(files["summary.txt"], encoding="utf-8").read()
    if not any(p["generalizes"] for p in res["patterns"]):
        assert "No reliable relationships" in s
