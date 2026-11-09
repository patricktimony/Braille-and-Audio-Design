"""Accessible Streamlit interface.

Design rules: every control has a visible text label; results are text and
plain tables (no charts, no colour coding); every table can be downloaded as
CSV; the full HTML report (semantic headings and captioned tables) can be
downloaded and read with JAWS, NVDA or VoiceOver.

Run with:  python -m empc app      (or: streamlit run empc/app.py)
"""
from __future__ import annotations

import os
import sys
import tempfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import pandas as pd  # noqa: E402
import streamlit as st  # noqa: E402

from empc.discovery import SearchConfig  # noqa: E402
from empc.pipeline import ExperimentConfig, run_experiment  # noqa: E402
from empc.report import pattern_rows, plain_summary, write_report  # noqa: E402

st.set_page_config(page_title="EMPC pattern discovery", layout="wide")
st.title("EMPC: pattern discovery across movement, sound and physiology")
st.markdown("Research prototype. Results are statistical associations, not causes. "
            "Patterns get neutral numbers, never emotion names. "
            "Use Tab to move between controls; all results are text tables you can download.")

st.header("1. Choose data")
source = st.radio("Data source", ["Synthetic demonstration data (planted relationships)",
                                  "Synthetic null world (no relationships; checks false alarms)",
                                  "My own video files"], index=0)
videos = physio = meta = None
if source.startswith("My own"):
    videos = st.file_uploader("Video files (mp4, mov, avi). Each file is one recording.", type=["mp4", "mov", "avi", "mkv"],
                              accept_multiple_files=True)
    physio = st.file_uploader("Optional physiology CSV files (column time_s plus hr, ibi_ms, eda, resp, pupil, gaze_x, gaze_y)",
                              type=["csv"], accept_multiple_files=True)
    meta = st.file_uploader("Optional channel metadata JSON (delays and uncertainty per channel)", type=["json"])

st.header("2. Settings")
quick = st.checkbox("Quick run (smaller budgets; less precise)", value=True)
strategy = st.selectbox("Search strategy used for the reported patterns", ["adaptive", "staged", "exhaustive"], index=0)
compare = st.multiselect("Strategies to run for the compute comparison", ["exhaustive", "staged", "adaptive"],
                         default=["staged", "adaptive"] if quick else ["exhaustive", "staged", "adaptive"])

st.header("3. Run")
if st.button("Run experiment"):
    log_lines: list[str] = []
    box = st.empty()

    def log(msg):
        log_lines.append(str(msg))
        box.text("\n".join(log_lines[-15:]))

    sc = SearchConfig(n_surrogates=199 if quick else 999, n_val_surrogates=49 if quick else 99)
    cfg = ExperimentConfig(search=sc, primary=strategy, compare=tuple(compare) or (strategy,),
                           stability_runs=1 if quick else 5, evolve_budget=100 if quick else 300,
                           evolve_seeds=(0,) if quick else (0, 1, 2), evolve_targets=1 if quick else 3,
                           max_patterns=12 if quick else 40)
    try:
        if source.startswith("Synthetic"):
            from empc.synthetic import make_dataset

            log("Generating synthetic data ...")
            ds = make_dataset(n_videos=5 if quick else 10, n_viewers=3, duration=90 if quick else 120,
                              coupled="null" not in source)
        else:
            from empc.ingest import assemble, load_video_unit

            if not videos:
                st.error("Please choose at least one video file.")
                st.stop()
            tmp = tempfile.mkdtemp()

            def save(f):
                p = os.path.join(tmp, f.name)
                with open(p, "wb") as fh:
                    fh.write(f.getbuffer())
                return p
            ppaths = [save(f) for f in (physio or [])]
            mpath = save(meta) if meta else None
            units = []
            for v in videos:
                log(f"Extracting features from {v.name} ...")
                u = load_video_unit(save(v), ppaths, mpath)
                log(f"  method {u['video_info']['method']}, {u['duration']:.1f} s")
                units.append(u)
            ds = assemble(units, synthetic=any(u["physio_synthetic"] for u in units))
        res = run_experiment(ds, cfg, log=log)
        out = os.path.join(tempfile.mkdtemp(), "report")
        files = write_report(res, out)
        st.session_state["res_files"] = files
        st.session_state["summary"] = plain_summary(res)
        st.session_state["patterns"] = pattern_rows(res)
        log("Done.")
    except Exception as exc:  # show errors as text
        st.error(f"The run stopped with an error: {exc}")

if "summary" in st.session_state:
    st.header("4. Results")
    st.subheader("Plain-language summary")
    st.text(st.session_state["summary"])
    st.subheader("Patterns table")
    rows = st.session_state["patterns"]
    if rows:
        cols = ["pattern", "status", "leader_signal", "follower_signal", "lag_s", "test_gain_r2",
                "chosen_model", "parameters", "stability"]
        st.table(pd.DataFrame(rows)[cols].round(3))
    else:
        st.text("No patterns passed the training-data tests.")
    st.subheader("Downloads")
    for name, path in st.session_state["res_files"].items():
        with open(path, "rb") as fh:
            st.download_button(f"Download {name}", fh.read(), file_name=name, key=f"dl-{name}")
