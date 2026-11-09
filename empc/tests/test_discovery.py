import numpy as np

from empc.data import family
from empc.discovery import STRATEGIES, SearchConfig, build_candidates
from empc.synthetic import dependency_exists


def _cfg():
    return SearchConfig(n_surrogates=199, n_val_surrogates=49, scales_s=(0.0, 1.0))


def test_candidates_cover_both_views(small_world):
    c = build_candidates(small_world, _cfg())
    assert any(x.view == "performer" for x in c) and any(x.view == "viewer" for x in c)
    assert all(not x.source.startswith("video.tracking") for x in c)


def test_strategies_find_planted_movement_sound_link(small_world):
    cands = build_candidates(small_world, _cfg())
    for name in ("staged", "adaptive"):
        r = STRATEGIES[name](small_world, cands, _cfg())
        fams = {(family(r.results[k]["predictor"]), family(r.results[k]["response"])) for k in r.confirmed}
        assert any(a in ("video.wrist_r", "video.elbow_r") and b.startswith("audio") for a, b in fams), name
        assert r.compute.total_ops > 0 and r.compute.cpu_s > 0


def test_adaptive_uses_less_compute_than_exhaustive(small_world):
    cands = build_candidates(small_world, _cfg())
    a = STRATEGIES["adaptive"](small_world, cands, _cfg())
    e = STRATEGIES["exhaustive"](small_world, cands, _cfg())
    assert a.compute.total_ops < e.compute.total_ops
    assert a.arms and "__scales__" in a.arms


def test_null_world_confirms_few_relationships(null_world):
    cands = build_candidates(null_world, _cfg())
    r = STRATEGIES["staged"](null_world, cands, _cfg())
    # FDR at 5 %: with no true effects almost nothing should survive B + C
    assert len(r.confirmed) <= 0.01 * len(cands)
