"""Feature access with per-segment standardisation, temporal scales and
compute accounting."""
from __future__ import annotations

import time
from dataclasses import dataclass, field

import numpy as np

from .data import Segment
from .signal_utils import moving_average, robust_z


@dataclass
class Compute:
    """Counts abstract operations and CPU time so search strategies can be
    compared on equal terms.  ops are rough multiply-add counts."""

    ops: dict = field(default_factory=dict)
    cpu_s: float = 0.0
    counts: dict = field(default_factory=dict)

    def add(self, kind: str, ops: float, n: int = 1):
        self.ops[kind] = self.ops.get(kind, 0.0) + float(ops)
        self.counts[kind] = self.counts.get(kind, 0) + n

    @property
    def total_ops(self) -> float:
        return float(sum(self.ops.values()))

    def timer(self):
        c = self

        class _T:
            def __enter__(self):
                self.t = time.process_time()

            def __exit__(self, *a):
                c.cpu_s += time.process_time() - self.t
        return _T()


class FeatureStore:
    """Z-scored, optionally smoothed feature arrays for a list of segments.

    ``fraction`` < 1 keeps only the first part of every segment (used for
    cheap screening on a subsample)."""

    def __init__(self, segments: list[Segment], compute: Compute | None = None, fraction: float = 1.0):
        self.segments = segments
        self.fraction = fraction
        self.compute = compute or Compute()
        self._z: dict = {}
        self._fft: dict = {}
        self.rate = segments[0].rate if segments else 10.0
        self.lengths = [int(s.n * fraction) for s in segments]

    def z(self, name: str, scale_s: float = 0.0) -> list[np.ndarray]:
        key = (name, scale_s)
        if key not in self._z:
            out = []
            for s, n in zip(self.segments, self.lengths):
                x = s.array(name)[:n]
                if scale_s > 0:
                    x = moving_average(x, max(1, int(round(scale_s * self.rate))))
                out.append(robust_z(x))
            self._z[key] = out
        return self._z[key]

    def filled(self, name: str, scale_s: float = 0.0) -> list[np.ndarray]:
        return [np.nan_to_num(z, nan=0.0) for z in self.z(name, scale_s)]

    def fft(self, name: str, scale_s: float = 0.0):
        key = (name, scale_s)
        if key not in self._fft:
            res = []
            for x in self.filled(name, scale_s):
                n = x.size
                res.append((np.fft.rfft(x), float(np.dot(x, x)), n))
                self.compute.add("fft", n * np.log2(max(n, 2)))
            self._fft[key] = res
        return self._fft[key]
