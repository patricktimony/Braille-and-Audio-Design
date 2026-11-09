"""Accessible reporting: plain text, Markdown, HTML (screen-reader friendly:
semantic headings, captioned tables with header scopes, no colour or
graphics needed) and CSV files."""
from __future__ import annotations

import csv
import html
import json
import os

import numpy as np

KIND_NAMES = {"M1": "single-lag linear", "M2": "sparse lagged kernel", "M3": "dense lagged kernel",
              "M4": "small neural network", "M5": "gradient-boosted trees"}


def _f(x, d=3):
    if x is None:
        return "n/a"
    if isinstance(x, (bool, np.bool_)):
        return "yes" if x else "no"
    if isinstance(x, (int, np.integer)):
        return str(int(x))
    try:
        x = float(x)
    except (TypeError, ValueError):
        return str(x)
    if not np.isfinite(x):
        return "n/a"
    if x != 0 and (abs(x) < 10 ** -d or abs(x) >= 1e5):
        return f"{x:.2e}"
    return f"{x:.{d}f}"


def pattern_rows(res) -> list[dict]:
    rows = []
    for p in res.get("patterns", []):
        t, m, dg = p["test"], p["model"], p["diag"]
        rows.append({
            "pattern": p["id"], "level": p["level"], "status": p["status"],
            "leader_signal": p["predictor"], "follower_signal": p["response"],
            "modalities": "+".join(p["modalities"]), "lag_s": p["lag_s"], "temporal_scale_s": p["scale_s"],
            "train_correlation": p["r_train"], "train_p": p["p_train"],
            "validation_gain_r2": p["val_gain"], "validation_bits_per_sample": p["val_bits"],
            "test_gain_r2": t.get("test_gain"), "test_p_shift": t.get("p_shift"), "test_p_block": t.get("p_block"),
            "test_mismatch_gain": t.get("mismatch_gain_mean"), "test_units": t.get("n_test_units"),
            "stability": p.get("stability"), "chosen_model": f"{m.kind} {KIND_NAMES[m.kind]}",
            "parameters": m.params, "flops_per_prediction": m.flops,
            "best_model": p["selection"].get("best_kind"), "equation": m.equation(res["dataset"].rate),
            "variants": len(p["variants"]), "merged_groups": "; ".join(p.get("merged_groups", [])),
            "plv": dg.get("plv"), "plv_null": dg.get("plv_null"),
            "mi_nonlinear_excess_nats": dg.get("mi_nonlinear_excess"), "dtw_ratio": dg.get("dtw_ratio"),
            "motif_ratio": dg.get("motif_ratio"), "note": p.get("mismatch_note", ""),
        })
    return rows


def ladder_rows(res) -> list[dict]:
    rows = []
    for p in res.get("patterns", []):
        for m in p["ladder"]:
            rows.append({"pattern": p["id"], "model": m.kind, "description": KIND_NAMES[m.kind],
                         "parameters": m.params, "flops_per_prediction": m.flops, "fit_cpu_s": m.fit_cpu_s,
                         "validation_gain_r2": m.val["gain"], "validation_bits_per_sample": m.val["bits"],
                         "chosen": m is p["model"]})
    return rows


def candidate_rows(res) -> list[dict]:
    sr = res["search"][res["config"].primary]
    rows = []
    for k, r in sr.results.items():
        c = r["candidate"]
        rows.append({"candidate": k, "source": c.source, "target": c.target, "scale_s": c.scale, "view": c.view,
                     "stage_reached": r.get("stage_reached"), "screen_p": r.get("screen_p"), "r": r.get("r"),
                     "lag_s": r.get("lag_s"), "p": r.get("p"), "fdr_pass": r.get("fdr_pass"),
                     "val_gain_r2": r.get("val_gain"), "val_p": r.get("val_p"), "val_bits": r.get("val_bits"),
                     "confirmed": r.get("confirmed")})
    return rows


def _write_csv(path, rows):
    if not rows:
        with open(path, "w", newline="", encoding="utf-8") as f:
            f.write("no rows\n")
        return
    keys = list(rows[0].keys())
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        for r in rows:
            w.writerow({k: (_f(v, 6) if isinstance(v, (float, np.floating)) else v) for k, v in r.items()})


def _ptext(t) -> str:
    if t.get("shift_exceed", 1) == 0 and t.get("block_exceed", 1) == 0:
        return (f"beat all {t['n_null']} time-shifted and all {t['n_block_null']} block-shuffled controls; "
                f"extrapolated p about {_f(max(t['p_shift'], t['p_block']))}")
    return f"p {_f(max(t['p_shift'], t['p_block']))} against time-shifted and block-shuffled controls"


def plain_summary(res) -> str:
    ds = res["dataset"]
    L = []
    if ds.synthetic:
        kind = {"null": "with NO planted relationships (null world)",
                "planted": "with planted relationships"}.get(getattr(ds, "world", ""), "(synthetic physiology supplied with the video)")
        L.append(f"IMPORTANT: this run used SYNTHETIC data {kind}. It tests the software; "
                 "it is not evidence about people.")
    if res.get("error"):
        return "\n".join(L + [res["error"]])
    pats = res.get("patterns", [])
    gen = [p for p in pats if p["generalizes"]]
    L.append(f"The system examined {res['n_candidates']} possible relationships between "
             f"{res['n_features']['video']} movement, {res['n_features']['audio']} sound and "
             f"{res['n_features']['physio']} physiological signals.")
    L.append(f"{len(pats)} relationship groups passed the training-data tests (shuffled-time controls, "
             f"false-discovery-rate correction and a validation stretch). "
             f"{len(gen)} of them also predicted held-out data better than shuffled controls.")
    if not gen:
        L.append("No reliable relationships were found on held-out data. This is reported as a negative result; "
                 "nothing has been invented to fill the gap.")
    for p in gen[:12]:
        t = p["test"]
        L.append(f"- Pattern {p['id'][1:]}: changes in {p['response']} tend to follow {p['predictor']} by about "
                 f"{p['lag_s']:.1f} s. On held-out recordings the leader signal explained an extra "
                 f"{100 * t['test_gain']:.1f}% of the follower's variance beyond the follower's own recent past "
                 f"({_ptext(t)}). "
                 f"Compact form: {KIND_NAMES[p['model'].kind]} with {p['model'].params} numbers."
                 + (f" Found in {100 * p['stability']:.0f}% of resampled training sets." if np.isfinite(p.get('stability', np.nan)) else "")
                 + (f" Caution: {p['mismatch_note']}" if p.get("mismatch_note") else ""))
    if len(gen) > 12:
        L.append(f"  ... and {len(gen) - 12} more in the tables.")
    comp = {r["strategy"]: r for r in res["strategy_comparison"]}
    if "exhaustive" in comp and res["config"].primary in comp and res["config"].primary != "exhaustive":
        a, e = comp[res["config"].primary], comp["exhaustive"]
        rec = lambda r: (f"recovered {100 * r['recall_of_exhaustive_families']:.0f}% of the relationship families "
                         "exhaustive search confirmed" if np.isfinite(r["recall_of_exhaustive_families"])
                         else "exhaustive search confirmed nothing, so recall is undefined")
        L.append(f"Search cost: the {a['strategy']} search used {100 * a['ops_vs_exhaustive']:.0f}% of the operations "
                 f"and {100 * a['cpu_vs_exhaustive']:.0f}% of the CPU time of uniform exhaustive search; it {rec(a)}.")
        if "staged" in comp and a["strategy"] != "staged":
            L.append(f"A simple staged filter (no learning) used {100 * comp['staged']['ops_vs_exhaustive']:.0f}% of exhaustive "
                     f"operations and {100 * comp['staged']['cpu_vs_exhaustive']:.0f}% of its CPU time; it {rec(comp['staged'])}.")
    c = res.get("compression")
    if c and gen:
        L.append(f"Compression: {c['features_in_generalized_patterns']} of {c['raw_features']} raw signals take part in the "
                 f"generalising patterns. Their chosen models use {c['chosen_params_total']} numbers in total, versus "
                 f"{c['dense_params_total']} for dense lag kernels and {c['gbm_params_total']} for boosted trees.")
    for a in res.get("abstraction", []):
        L.append(f"Level-2 check for {a['target']}: held-out gain {_f(a['pattern_test_gain'])} from pattern-derived "
                 f"signal {a['best_pattern_signal']} versus {_f(a['raw_test_gain'])} from the best raw signal "
                 f"{a['best_raw_signal']} ({'abstraction helped' if a['abstraction_helped'] else 'abstraction did not help'}).")
    if res.get("evolution"):
        import pandas as pd
        ev = pd.DataFrame(res["evolution"]).groupby("method")[["best_val_bits", "test_gain"]].mean()
        L.append("Evolutionary vs random vs greedy search (equal budgets, mean over targets and seeds): " +
                 "; ".join(f"{m}: validation {r.best_val_bits:.3f} bits/sample, held-out gain {r.test_gain:.3f}"
                           for m, r in ev.iterrows()) + ".")
    gt = res.get("ground_truth")
    if gt:
        if gt.get("null_world"):
            L.append(f"Null world check: {len(gt['false_positive_patterns_generalized'])} patterns generalised although "
                     "no relationships were planted (each one is a false positive).")
        else:
            for r in gt["relations"]:
                L.append(f"Planted {r['id']} ({r['description']}): "
                         f"{'recovered and generalised' if r['found_generalized'] else 'found in training only' if r['found_validation'] else 'NOT recovered'}.")
            L.append(f"Patterns generalising without any planted dependency (false positives): "
                     f"{len(gt['false_positive_patterns_generalized'])}.")
    L.append("Correlation and prediction here do not establish causation, and patterns carry neutral identifiers "
             "only; interpretation is left to human researchers.")
    return "\n".join(L)


def _table(caption, rows, cols=None):
    if not rows:
        return f"<p>{html.escape(caption)}: none.</p>"
    cols = cols or list(rows[0].keys())
    h = [f"<table><caption>{html.escape(caption)}</caption><thead><tr>"]
    h += [f'<th scope="col">{html.escape(c.replace("_", " "))}</th>' for c in cols]
    h.append("</tr></thead><tbody>")
    for r in rows:
        h.append("<tr>")
        for i, c in enumerate(cols):
            v = html.escape(_f(r.get(c)) if not isinstance(r.get(c), str) else r.get(c))
            h.append(f'<th scope="row">{v}</th>' if i == 0 else f"<td>{v}</td>")
        h.append("</tr>")
    h.append("</tbody></table>")
    return "".join(h)


def _md_table(rows, cols=None):
    if not rows:
        return "_none_\n"
    cols = cols or list(rows[0].keys())
    s = "| " + " | ".join(c.replace("_", " ") for c in cols) + " |\n|" + "---|" * len(cols) + "\n"
    for r in rows:
        s += "| " + " | ".join((r.get(c) if isinstance(r.get(c), str) else _f(r.get(c))).replace("|", "/") for c in cols) + " |\n"
    return s


def write_report(res, out_dir: str) -> dict:
    os.makedirs(out_dir, exist_ok=True)
    files = {}
    summary = plain_summary(res)
    pr, lr = pattern_rows(res), ladder_rows(res)
    comp = res.get("strategy_comparison", [])
    evo = res.get("evolution", [])
    gt = res.get("ground_truth") or {}
    sr = res.get("search", {}).get(res["config"].primary) if res.get("search") else None
    arms = []
    if sr is not None and sr.arms:
        for k, v in sr.arms.items():
            if k != "__scales__":
                arms.append({"arm": k, **v})
        arms.sort(key=lambda a: -a["posterior_mean"])
    lat = res.get("latent")
    for name, rows in (("abstraction.csv", res.get("abstraction", [])), ("patterns.csv", pr), ("model_ladder.csv", lr), ("search_comparison.csv", comp),
                       ("evolution.csv", evo), ("search_arms.csv", arms),
                       ("ground_truth.csv", gt.get("relations", [])),
                       ("candidates.csv", candidate_rows(res) if sr else [])):
        _write_csv(os.path.join(out_dir, name), rows)
        files[name] = os.path.join(out_dir, name)
    with open(os.path.join(out_dir, "summary.txt"), "w", encoding="utf-8") as f:
        f.write(summary + "\n")
    files["summary.txt"] = os.path.join(out_dir, "summary.txt")

    main_cols = ["pattern", "level", "status", "leader_signal", "follower_signal", "lag_s", "temporal_scale_s",
                 "test_gain_r2", "test_p_shift", "test_p_block", "test_mismatch_gain", "stability",
                 "chosen_model", "parameters"]
    comp_cols = ["strategy", "candidates", "screened_on_subsample", "full_null_tests", "predictive_checks",
                 "confirmed_families", "ops", "cpu_s", "ops_vs_exhaustive", "recall_of_exhaustive_families"]
    eq_rows = [{"pattern": r["pattern"], "equation": r["equation"], "best_model": r["best_model"],
                "variants": r["variants"], "merged_groups": r["merged_groups"], "note": r["note"]} for r in pr]
    diag_rows = [{k: r[k] for k in ("pattern", "plv", "plv_null", "mi_nonlinear_excess_nats", "dtw_ratio", "motif_ratio")} for r in pr]
    lat_rows = []
    if lat:
        lat_rows = [{"lag_s": lat["lag_s"], "validation_r": lat["val_r"], "test_r": lat["test_r"], "p_shift": lat["p_shift"],
                     "null_mean_abs_r": lat["null_mean_abs"],
                     "top_movement_weights": "; ".join(f"{n} {w:+.2f}" for n, w in lat["video_weights"]),
                     "top_sound_weights": "; ".join(f"{n} {w:+.2f}" for n, w in lat["audio_weights"])}]
    sections = [
        ("summary", "Plain-language summary", "<pre>" + html.escape(summary) + "</pre>", "```\n" + summary + "\n```\n"),
        ("patterns", "Patterns (neutral identifiers)", _table("Discovered patterns and held-out test results", pr, main_cols),
         _md_table(pr, main_cols)),
        ("equations", "Mathematical representations", _table("Compact representation of each pattern", eq_rows),
         _md_table(eq_rows)),
        ("ladder", "Model ladder (minimum-intelligence selection)", _table("Every model fitted per pattern", lr), _md_table(lr)),
        ("diagnostics", "Other cross-modal measures at the discovered lag",
         "<p>Phase locking (PLV) above its null, positive nonlinear mutual-information excess, and DTW or motif ratios below 1 indicate structure beyond chance.</p>"
         + _table("Diagnostics on training data", diag_rows), _md_table(diag_rows)),
        ("search", "Search strategy comparison", _table("Compute and recall for each search strategy", comp, comp_cols),
         _md_table(comp, comp_cols)),
        ("arms", "What the adaptive search learned to attend to", _table("Signal-family pairs ranked by posterior success rate", arms[:40]),
         _md_table(arms[:40])),
        ("latent", "Shared latent movement-sound component (CCA)", _table("Lagged canonical correlation", lat_rows), _md_table(lat_rows)),
        ("abstraction", "Did pattern-derived (level-2) signals help?", _table("Head-to-head on held-out data", res.get("abstraction", [])),
         _md_table(res.get("abstraction", []))),
        ("evolution", "Evolutionary versus random versus greedy search", _table("Equal-budget comparison", evo), _md_table(evo)),
    ]
    if gt:
        sections.append(("groundtruth", "Synthetic ground-truth check", _table("Planted relationships", gt.get("relations", [])),
                         _md_table(gt.get("relations", []))))
    notes = res.get("notes", []) + LIMITATIONS
    nav = "".join(f'<li><a href="#{a}">{html.escape(t)}</a></li>' for a, t, _, _ in sections)
    body = "".join(f'<section aria-labelledby="h-{a}"><h2 id="h-{a}"><a id="{a}"></a>{html.escape(t)}</h2>{h}</section>'
                   for a, t, h, _ in sections)
    page = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>EMPC experiment report</title>
<style>body{{font-family:system-ui,sans-serif;max-width:70rem;margin:auto;padding:1rem;line-height:1.5;background:#fff;color:#111}}
table{{border-collapse:collapse;margin:1rem 0;font-size:.9rem}}th,td{{border:1px solid #444;padding:.25rem .5rem;text-align:left;vertical-align:top}}
caption{{font-weight:bold;text-align:left}}pre{{white-space:pre-wrap}}a:focus,a:hover{{outline:3px solid #000}}
.skip{{position:absolute;left:-999px}}.skip:focus{{left:1rem;top:1rem;background:#fff}}</style></head>
<body><a class="skip" href="#main">Skip to report</a><header><h1>EMPC experiment report</h1></header>
<nav aria-label="Report sections"><ul>{nav}</ul></nav><main id="main">{body}
<section aria-labelledby="h-notes"><h2 id="h-notes">Notes, assumptions and limitations</h2><ul>{''.join('<li>' + html.escape(n) + '</li>' for n in notes)}</ul></section>
<section aria-labelledby="h-files"><h2 id="h-files">Downloadable tables (CSV)</h2><ul>{''.join(f'<li><a href="{n}">{n}</a></li>' for n in files if n.endswith('.csv'))}</ul></section>
</main></body></html>"""
    with open(os.path.join(out_dir, "report.html"), "w", encoding="utf-8") as f:
        f.write(page)
    md = "# EMPC experiment report\n\n" + "".join(f"## {t}\n\n{m}\n" for _, t, _, m in sections)
    md += "## Notes, assumptions and limitations\n\n" + "".join(f"- {n}\n" for n in notes)
    with open(os.path.join(out_dir, "report.md"), "w", encoding="utf-8") as f:
        f.write(md)
    files["report.html"] = os.path.join(out_dir, "report.html")
    files["report.md"] = os.path.join(out_dir, "report.md")
    with open(os.path.join(out_dir, "results.json"), "w", encoding="utf-8") as f:
        json.dump({"summary": summary, "patterns": pr, "search_comparison": comp, "compression": res.get("compression"),
                   "abstraction": res.get("abstraction"), "latent": lat_rows, "ground_truth": gt,
                   "n_candidates": res.get("n_candidates"), "elapsed_s": res.get("elapsed_s")},
                  f, indent=1, default=lambda o: _f(o, 6) if isinstance(o, (float, np.floating)) else str(o))
    files["results.json"] = os.path.join(out_dir, "results.json")
    return files


LIMITATIONS = [
    "Associations and predictive relationships are not causal claims and do not reveal universal principles of human behaviour.",
    "Monocular pose depth (features ending in _est) is a model estimate, not a physical measurement.",
    "Patterns are named with neutral identifiers only; no psychological or intentional meaning is assigned.",
    "Significance relies on circular-shift and block-shuffle surrogates; p-values smaller than the surrogate count allows are tail extrapolations (Gumbel or Gaussian fits) and are approximate.",
    "Validation data overlaps the data used to choose lags; only the held-out test recordings give an unbiased estimate.",
    "With few recordings, held-out testing cannot show that a pattern generalises to new people.",
]
