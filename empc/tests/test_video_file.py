import shutil

import pytest

from empc.ingest import assemble, load_video_unit
from empc.synthetic import render_demo_video


@pytest.mark.skipif(shutil.which("ffmpeg") is None, reason="ffmpeg not installed")
def test_video_file_pipeline_extracts_synchronised_features(tmp_path):
    p = render_demo_video(str(tmp_path / "demo.mp4"), duration=15, seed=2)
    u = load_video_unit(p, max_fps=15)
    assert u["video_streams"] and u["audio_streams"]
    assert abs(u["duration"] - 15) < 1.0
    ds = assemble([u])
    assert {s.role for s in ds.performer} == {"train", "test"}  # single video -> time split
    cols = ds.performer[0].frame.columns
    assert any(c.startswith("video.") for c in cols) and any(c.startswith("audio.") for c in cols)
