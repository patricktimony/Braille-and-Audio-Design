"""Core data containers shared by every module.

Feature naming convention: ``modality.family.measure`` e.g.
``video.wrist_r.speed``, ``audio.energy.rms_db``, ``physio.eda.phasic``.
The family (first two parts) is the unit the adaptive search learns about.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np
import pandas as pd


def modality(name: str) -> str:
    return name.split(".")[0]


def family(name: str) -> str:
    return ".".join(name.split(".")[:2])


@dataclass
class Segment:
    """A contiguous stretch of synchronised features on a common time grid.

    ``unit`` identifies the independent recording (a video, or a video+viewer
    session).  Segments from the same unit are never split across train/test.
    """

    unit: str
    role: str  # "train" or "test"
    frame: pd.DataFrame  # index: time in seconds; columns: feature names
    rate: float
    video: str = ""
    viewer: str = ""

    @property
    def n(self) -> int:
        return len(self.frame)

    def array(self, name: str) -> np.ndarray:
        if name not in self.frame.columns:
            return np.full(self.n, np.nan)
        return self.frame[name].to_numpy(dtype=float)


@dataclass
class Dataset:
    """Two views of the data.

    performer: one segment per video (video + audio features).  Used for
        relationships between the performer's movement and sound, so a video
        watched by several viewers is not counted several times.
    viewer: one segment per (video, viewer) session with physiology added.
    """

    performer: list[Segment]
    viewer: list[Segment]
    rate: float
    synthetic: bool
    notes: list[str] = field(default_factory=list)
    ground_truth: list[dict] = field(default_factory=list)
    channel_meta: dict = field(default_factory=dict)
    world: str = ""  # synthetic generator only: "planted" or "null"; empty for recordings/files

    def segments(self, view: str, role: str | None = None) -> list[Segment]:
        segs = self.performer if view == "performer" else self.viewer
        return [s for s in segs if role is None or s.role == role]

    def features(self, view: str, prefix: str | None = None) -> list[str]:
        cols: list[str] = []
        for s in self.segments(view):
            for c in s.frame.columns:
                if c not in cols and (prefix is None or c.startswith(prefix)):
                    cols.append(c)
        # drop features that are (nearly) constant or empty everywhere in train
        keep = []
        for c in cols:
            vals = np.concatenate([s.array(c) for s in self.segments(view, "train")] or [np.array([])])
            vals = vals[np.isfinite(vals)]
            if vals.size > 20 and np.nanstd(vals) > 1e-9:
                keep.append(c)
        return keep
