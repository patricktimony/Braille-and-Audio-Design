"""End-to-end experiment orchestration."""
from __future__ import annotations

import copy
import time
from dataclasses import dataclass, field

import numpy as np

from .compression import fit_ladder, select_minimal
from .data import Dataset, family, modality
from .discovery import STRATEGIES, SearchConfig, build_candidates, roles
from .evaluation import diagnostics, test_model
from .evolve import compare as evolve_compare
from .latent import lagged_cca
from .signal_utils import moving_average, robust_z
from .stats import bh_fdr
from .store import FeatureStore


@dataclass
class ExperimentConfig:
    search: SearchConfig = field(default_factory=SearchConfig)
    primary: str = "adaptive"
    compare: tuple = ("exhaustive", "staged", "adaptive")
    stability_runs: int = 5
    stability_fraction: float = 0.75
    evolve_budget: int = 300
    evolve_seeds: tuple = (0, 1, 2)
    evolve_targets: int = 3
    level2: bool = True
    max_patterns: int = 40
    run_diagnostics: bool = True
    alpha_test: float = 0.05
    seed: int = 0


def cluster(sr, level: int) -> list[dict]:
    """Group confirmed candidates that express the same relationship
    (same leader family -> follower family, same view); keep the one that
    saves the most bits on validation as the representative."""
    groups: dict = {}
    for k in sr.confirmed:
        rec = sr.results[k]
        c = rec["candidate"]
        key = (c.view, family(rec["predictor"]), family(rec["response"]))
        groups.setdefault(key, []).append(rec)
    out = []
    for key, recs in groups.items():
        recs.sort(key=lambda r: -r["val_bits"])
        out.append({"level": level, "view": key[0], "group": f"{key[1]} -> {key[2]}", "rep": recs[0],
                    "variants": [r["candidate"].key for r in recs]})
    out.sort(key=lambda g: -g["rep"]["val_bits"])
    return out


def _drive_corr(store, a, b):
    """Pooled correlation between two lagged signals given as (name, scale, lag)."""
    from .discovery import lagged
    num = da = db = 0.0
    for xa, xb in zip(store.z(a[0], a[1]), store.z(b[0], b[1])):
        u = np.nan_to_num(lagged(xa, a[2]))
        v = np.nan_to_num(lagged(xb, b[2]))
        num += float(u @ v); da += float(u @ u); db += float(v @ v)
    return num / np.sqrt(da * db) if da > 0 and db > 0 else 0.0


def merge_redundant(groups: list[dict], ds: Dataset, thr: float = 0.8) -> list[dict]:
    """Compress near-duplicate patterns: two groups are merged when their
    leader signals (at their lags) AND their follower signals are correlated
    with |r| >= thr on training data.  The merged pattern keeps the variant
    that saves the most bits and lists the rest as variants."""
    stores = {v: FeatureStore(ds.segments(v, "train")) for v in ("performer", "viewer") if ds.segments(v, "train")}
    parent = list(range(len(groups)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i
    keys = []
    for g in groups:
        r = g["rep"]
        keys.append(((r["predictor"], r["candidate"].scale, r["tau"]), (r["response"], r["candidate"].scale, 0)))
    for i in range(len(groups)):
        for j in range(i + 1, len(groups)):
            if groups[i]["view"] != groups[j]["view"] or find(i) == find(j):
                continue
            st = stores[groups[i]["view"]]
            if abs(_drive_corr(st, keys[i][1], keys[j][1])) >= thr and abs(_drive_corr(st, keys[i][0], keys[j][0])) >= thr:
                parent[find(j)] = find(i)
    merged: dict = {}
    for i, g in enumerate(groups):
        merged.setdefault(find(i), []).append(g)
    out = []
    for members in merged.values():
        members.sort(key=lambda g: -g["rep"]["val_bits"])
        top = dict(members[0])
        top["variants"] = [v for g in members for v in g["variants"]]
        top["merged_groups"] = [g["group"] for g in members]
        out.append(top)
    out.sort(key=lambda g: -g["rep"]["val_bits"])
    return out


def _subset(ds: Dataset, rng, frac: float) -> Dataset:
    d = copy.copy(ds)
    for view in ("performer", "viewer"):
        segs = ds.segments(view)
        units = sorted({s.unit for s in segs if s.role == "train"})
        k = max(1, int(round(frac * len(units))))
        keep = set(rng.choice(units, size=k, replace=False)) if units else set()
        setattr(d, view, [s for s in segs if s.role == "test" or s.unit in keep])
    return d


def add_pattern_features(ds: Dataset, patterns: list[dict]) -> list[str]:
    """Turn level-1 movement<->sound patterns into reusable signals on the
    viewer segments: ``drive`` (the leader's predicted contribution) and
    ``coact`` (2 s average of positive co-activation of leader and follower).
    Coefficients come from training data only."""
    names = []
    for p in patterns:
        m = p.get("model")
        if p["view"] != "performer" or m is None or m.coef is None:
            continue
        b = m.coef[1 + len(m.slags):]
        for seg in ds.viewer:
            x = robust_z(_smooth(seg.array(m.predictor), m.scale, seg.rate))
            y = robust_z(_smooth(seg.array(m.response), m.scale, seg.rate))
            xf = np.nan_to_num(x)
            drive = np.zeros(seg.n)
            for coef, L in zip(b, m.src_lags):
                drive[L:] += coef * xf[:seg.n - L] if L else coef * xf
            co = moving_average(np.maximum(drive * np.nan_to_num(y), 0.0), int(2 * seg.rate))
            seg.frame[f"pattern.{p['id']}.drive"] = drive
            seg.frame[f"pattern.{p['id']}.coact"] = co
        names += [f"pattern.{p['id']}.drive", f"pattern.{p['id']}.coact"]
    return names


def _smooth(x, scale, rate):
    return moving_average(x, max(1, int(round(scale * rate)))) if scale > 0 else x


def _analyse_patterns(ds, groups, cfg: ExperimentConfig, rng, start_id: int, log) -> list[dict]:
    sc = cfg.search
    stores = {v: (FeatureStore(ds.segments(v, "train")), FeatureStore(ds.segments(v, "test")))
              for v in ("performer", "viewer") if ds.segments(v)}
    pats = []
    for i, g in enumerate(groups[:cfg.max_patterns]):
        rep = g["rep"]
        c = rep["candidate"]
        pred, resp, tau = roles(c, rep["lag"])
        tr, te = stores[c.view]
        models, base = fit_ladder(tr, pred, resp, c.scale, tau, sc, rng)
        if not models:
            continue
        chosen, sel = select_minimal(models, rng)
        test = test_model(chosen, te, rng) if te.segments else {}
        diag = diagnostics(tr, pred, resp, c.scale, tau, rng) if cfg.run_diagnostics else {}
        pid = f"P{start_id + len(pats):03d}"
        pats.append({"id": pid, "level": g["level"], "view": c.view, "group": g["group"],
                     "merged_groups": g.get("merged_groups", [g["group"]]),
                     "predictor": pred, "response": resp, "scale_s": c.scale, "lag_s": tau / ds.rate,
                     "modalities": sorted({modality(pred), modality(resp)}),
                     "r_train": rep["r"], "p_train": rep["p"], "val_gain": rep["val_gain"], "val_bits": rep["val_bits"],
                     "variants": g["variants"], "ladder": models, "model": chosen, "selection": sel,
                     "base": base, "test": test, "diag": diag})
        log(f"  {pid}: {pred} -> {resp} lag {tau / ds.rate:.1f}s, chosen {chosen.kind} "
            f"({chosen.params} params), test gain {test.get('test_gain', float('nan')):.3f}")
    return pats


def _verdicts(patterns, alpha):
    ps = np.array([max(p["test"].get("p_shift", 1.0), p["test"].get("p_block", 1.0)) for p in patterns])
    ok = bh_fdr(ps, alpha) if len(ps) else np.zeros(0, bool)
    for p, s in zip(patterns, ok):
        t = p["test"]
        gen = bool(s) and t.get("test_gain", -1) > 0
        p["generalizes"] = gen
        p["status"] = ("Generalizes to held-out data" if gen else
                       "No held-out data available" if not t else
                       "Did not generalize (validated on training data only)")
        mm = t.get("mismatch_gain_mean", np.nan)
        p["mismatch_note"] = ""
        if gen and np.isfinite(mm) and mm > 0.5 * t["test_gain"]:
            p["mismatch_note"] = ("Also predicts when paired with a different recording: may reflect "
                                  "generic signal properties or shared stimulus timing, not a recording-specific coupling.")


def _gt_eval(ds, patterns, results):
    from .synthetic import dependency_exists

    rows = []
    for gt in ds.ground_truth:
        def match(p):
            s, t = family(p["predictor"]), family(p["response"])
            lo, hi = gt["lag_s"]
            for a, b in ((s, t), (t, s)):
                if any(a.startswith(x) for x in gt["sources"]) and any(b.startswith(x) for x in gt["targets"]):
                    lag = p["lag_s"] if (a, b) == (s, t) else -p["lag_s"]
                    if lo <= lag <= hi:
                        return True
            return False
        rows.append({"id": gt["id"], "description": gt["description"],
                     "found_validation": any(match(p) for p in patterns),
                     "found_generalized": any(match(p) and p["generalizes"] for p in patterns),
                     "patterns": ", ".join(p["id"] for p in patterns if match(p))})
    fps = [p["id"] for p in patterns if p["generalizes"]
           and not dependency_exists(family(p["predictor"]), family(p["response"]))]
    fps_val = [p["id"] for p in patterns
               if not dependency_exists(family(p["predictor"]), family(p["response"]))]
    strat = {}
    for name, sr in results.items():
        fams = {(family(sr.results[k]["predictor"]), family(sr.results[k]["response"])) for k in sr.confirmed}
        strat[name] = {"families_confirmed": len(fams),
                       "families_without_dependency": sum(not dependency_exists(a, b) for a, b in fams)}
    return {"relations": rows, "false_positive_patterns_generalized": fps,
            "false_positive_patterns_validation": fps_val, "by_strategy": strat}


def _abstraction_check(ds, patterns, primary, cfg, rng) -> list[dict]:
    """For each physiological target reached by a level-2 pattern, compare
    head-to-head with the best raw-signal candidate for the same target
    (chosen on training data only), both fitted the same way and tested on
    the same held-out recordings."""
    from .compression import fit_ladder, select_minimal
    sc = cfg.search
    tr, te = FeatureStore(ds.segments("viewer", "train")), FeatureStore(ds.segments("viewer", "test"))
    rows = []
    for tgt in sorted({p["response"] for p in patterns if p["level"] == 2}):
        l2 = [p for p in patterns if p["level"] == 2 and p["response"] == tgt]
        raw = [r for r in primary.results.values() if r["candidate"].target == tgt and "p" in r]
        if not raw:
            raw = []
        best_raw = max(raw, key=lambda r: r.get("val_bits", -1) if "val_bits" in r else abs(r["r"]) - 1, default=None)
        raw_gain, raw_name, raw_params = np.nan, "none screened", np.nan
        if best_raw is not None and te.segments:
            c = best_raw["candidate"]
            ms, _ = fit_ladder(tr, c.source, tgt, c.scale, max(0, best_raw["lag"]), sc, rng)
            if ms:
                m, _ = select_minimal(ms, rng)
                raw_gain = test_model(m, te, rng, n_null=19).get("test_gain", np.nan)
                raw_name, raw_params = f"{c.source} (scale {c.scale:g} s, lag {best_raw['lag_s']:.1f} s)", m.params
        b2 = max(l2, key=lambda p: p["val_bits"])
        rows.append({"target": tgt, "best_raw_signal": raw_name, "raw_test_gain": raw_gain, "raw_params": raw_params,
                     "best_pattern_signal": b2["predictor"], "pattern_test_gain": b2["test"].get("test_gain", np.nan),
                     "pattern_params": b2["model"].params,
                     "abstraction_helped": bool(b2["test"].get("test_gain", -1) > (raw_gain if np.isfinite(raw_gain) else -1))})
    return rows


def run_experiment(ds: Dataset, cfg: ExperimentConfig | None = None, log=print) -> dict:
    cfg = cfg or ExperimentConfig()
    sc = cfg.search
    rng = np.random.default_rng(cfg.seed)
    t_start = time.time()
    out: dict = {"config": cfg, "dataset": ds, "notes": list(ds.notes)}
    cands = build_candidates(ds, sc)
    out["n_candidates"] = len(cands)
    out["n_features"] = {m: len([f for f in set(ds.features("performer") + ds.features("viewer"))
                                 if modality(f) == m]) for m in ("video", "audio", "physio")}
    log(f"{len(cands)} candidate relationships over {out['n_features']} features")
    if not cands:
        out["error"] = "No candidate relationships: need at least two modalities with usable features."
        return out

    # 1. search strategies ------------------------------------------------
    results = {}
    names = list(dict.fromkeys(list(cfg.compare) + [cfg.primary]))
    for name in names:
        log(f"search: {name} ...")
        results[name] = STRATEGIES[name](ds, cands, sc, seed=cfg.seed)
        r = results[name]
        log(f"  {name}: {len(r.confirmed)} confirmed, {r.compute.cpu_s:.1f} s CPU, {r.compute.total_ops:.3g} ops")
    out["search"] = results
    primary = results[cfg.primary]
    ref = results.get("exhaustive")
    comp = []
    for name, r in results.items():
        recs = r.results.values()
        fams = {(family(x["predictor"]), family(x["response"])) for x in (r.results[k] for k in r.confirmed)}
        row = {"strategy": name, "candidates": r.n_candidates,
               "screened_on_subsample": sum("screen_p" in x for x in recs),
               "full_null_tests": sum("p" in x for x in recs),
               "predictive_checks": sum("val_gain" in x for x in recs),
               "confirmed_candidates": len(r.confirmed), "confirmed_families": len(fams),
               "ops": r.compute.total_ops, "cpu_s": r.compute.cpu_s}
        if ref is not None:
            rf = {(family(ref.results[k]["predictor"]), family(ref.results[k]["response"])) for k in ref.confirmed}
            row["recall_of_exhaustive_candidates"] = (len(set(r.confirmed) & set(ref.confirmed)) / len(ref.confirmed)
                                                      if ref.confirmed else np.nan)
            row["recall_of_exhaustive_families"] = len(fams & rf) / len(rf) if rf else np.nan
            row["ops_vs_exhaustive"] = r.compute.total_ops / ref.compute.total_ops
            row["cpu_vs_exhaustive"] = r.compute.cpu_s / max(ref.compute.cpu_s, 1e-9)
        comp.append(row)
    out["strategy_comparison"] = comp

    # 2. compress + test level-1 patterns ---------------------------------
    log("compressing and testing level-1 patterns ...")
    groups = cluster(primary, 1)
    out["n_clusters_level1_before_merge"] = len(groups)
    groups = merge_redundant(groups, ds)
    out["n_clusters_level1"] = len(groups)
    log(f"  {out['n_clusters_level1_before_merge']} family groups merged into {len(groups)} non-redundant patterns")
    patterns = _analyse_patterns(ds, groups, cfg, rng, 1, log)

    # 3. level 2: search with pattern-derived signals ---------------------
    out["level2"] = None
    if cfg.level2 and ds.viewer and any(p["view"] == "performer" for p in patterns):
        derived = add_pattern_features(ds, patterns)
        c2 = build_candidates(ds, sc, sources_extra=derived, only_extra=True)
        if c2:
            log(f"level 2: {len(c2)} candidates using {len(derived)} pattern-derived signals ...")
            r2 = STRATEGIES[cfg.primary](ds, c2, sc, seed=cfg.seed + 1)
            g2 = merge_redundant(cluster(r2, 2), ds)
            p2 = _analyse_patterns(ds, g2, cfg, rng, len(patterns) + 1, log)
            out["level2"] = {"candidates": len(c2), "derived": derived, "search": r2, "n_clusters": len(g2)}
            patterns += p2

    _verdicts(patterns, cfg.alpha_test)
    out["patterns"] = patterns

    # abstraction check: do level-2 patterns beat raw ones for the same target?
    out["abstraction"] = _abstraction_check(ds, patterns, primary, cfg, rng)

    # 4. shared latent (CCA) ----------------------------------------------
    out["latent"] = None
    if ds.segments("performer", "train") and ds.segments("performer", "test"):
        vf = [f for f in ds.features("performer", "video.") if not f.startswith(sc.exclude)]
        af = ds.features("performer", "audio.")
        tr, te = FeatureStore(ds.segments("performer", "train")), FeatureStore(ds.segments("performer", "test"))
        log("shared latent (CCA) ...")
        out["latent"] = lagged_cca(tr, te, vf, af, ds.rate, rng)

    # 5. evolutionary vs random vs greedy ---------------------------------
    evo = []
    targets = []
    for p in sorted(patterns, key=lambda p: -p["val_bits"]):
        if p["response"] not in targets and not p["response"].startswith("pattern"):
            targets.append(p["response"])
    physio_first = sorted(targets, key=lambda t: not t.startswith("physio"))[:cfg.evolve_targets]
    for tgt in physio_first:
        view = "viewer" if tgt.startswith("physio") else "performer"
        tr, te = FeatureStore(ds.segments(view, "train")), FeatureStore(ds.segments(view, "test"))
        tm = modality(tgt)
        srcs = [f for f in ds.features(view) if modality(f) not in (tm, "pattern") and not f.startswith(sc.exclude)
                and (tm == "physio" or modality(f) != "physio")]
        if not srcs or not te.segments:
            continue
        log(f"evolutionary comparison for {tgt} over {len(srcs)} sources ...")
        evo += evolve_compare(tr, te, tgt, srcs, sc, budget=cfg.evolve_budget, seeds=cfg.evolve_seeds)
    out["evolution"] = evo

    # 6. stability across resamples of training recordings ----------------
    stab_keys = []
    for k in range(cfg.stability_runs):
        sub = _subset(ds, np.random.default_rng(cfg.seed + 100 + k), cfg.stability_fraction)
        c_sub = build_candidates(sub, sc)
        r_sub = STRATEGIES[cfg.primary](sub, c_sub, sc, seed=cfg.seed + 100 + k)
        stab_keys.append({(g["view"], g["group"]) for g in cluster(r_sub, 1)})
        log(f"stability run {k + 1}/{cfg.stability_runs}: {len(stab_keys[-1])} pattern groups")
    for p in patterns:
        p["stability"] = (np.mean([(p["view"], p["group"]) in s for s in stab_keys])
                          if stab_keys and p["level"] == 1 else np.nan)

    # 7. compression summary ----------------------------------------------
    gen = [p for p in patterns if p["generalizes"]]
    all_feats = set(ds.features("performer")) | {f for f in ds.features("viewer") if not f.startswith("pattern")}
    used = sorted({f for p in gen for f in (p["predictor"], p["response"]) if not f.startswith("pattern")})
    out["compression"] = {
        "raw_features": len(all_feats), "features_in_generalized_patterns": len(used), "features_used": used,
        "chosen_params_total": int(sum(p["model"].params for p in gen)),
        "best_scoring_params_total": int(sum(next(m.params for m in p["ladder"] if m.kind == p["selection"]["best_kind"]) for p in gen)),
        "dense_params_total": int(sum(next((m.params for m in p["ladder"] if m.kind == "M3"), 0) for p in gen)),
        "gbm_params_total": int(sum(next((m.params for m in p["ladder"] if m.kind == "M5"), 0) for p in gen)),
        "chosen_kinds": {k: sum(p["model"].kind == k for p in gen) for k in ("M1", "M2", "M3", "M4", "M5")},
    }
    if getattr(ds, "world", "") == "planted" and ds.ground_truth:
        out["ground_truth"] = _gt_eval(ds, patterns, results)
    elif getattr(ds, "world", "") == "null":
        out["ground_truth"] = {"relations": [], "null_world": True,
                               "false_positive_patterns_generalized": [p["id"] for p in gen],
                               "false_positive_patterns_validation": [p["id"] for p in patterns],
                               "by_strategy": {n: {"families_confirmed": len({(family(r.results[k]["predictor"]), family(r.results[k]["response"])) for k in r.confirmed})}
                                               for n, r in results.items()}}
    out["elapsed_s"] = time.time() - t_start
    return out
