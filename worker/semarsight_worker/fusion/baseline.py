"""Baseline kepadatan per kamera dan indeks kepadatan relatif.

Setiap kamera dibandingkan dengan dirinya sendiri. Sebelum baseline per jam-dalam-minggu
tersedia (butuh beberapa hari data), dipakai baseline sementara: median 24 jam bergulir.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta

import numpy as np

WINDOW = timedelta(hours=24)
MIN_SAMPLES = 12  # sekitar 1 jam data sebelum indeks dianggap bermakna
LEVEL_UPPER_BOUNDS = ((0.8, "lancar"), (1.3, "normal"), (1.8, "ramai"))
TOP_LEVEL = "padat"
UNKNOWN_LEVEL = "tidak_diketahui"
ANOMALY_MIN_INDEX = 1.5
ANOMALY_CYCLES = 2


@dataclass(frozen=True)
class Baseline:
    median: float
    p90: float
    n: int
    provisional: bool


def density_index(value: float, median: float) -> float:
    return value / max(median, 1.0)


def density_level(index: float | None) -> str:
    if index is None:
        return UNKNOWN_LEVEL
    for upper, level in LEVEL_UPPER_BOUNDS:
        if index < upper:
            return level
    return TOP_LEVEL


def exceeds_baseline(value: float, baseline: Baseline) -> bool:
    """Satu pembacaan melampaui pola normal: di atas p90 dan indeks >= 1,5."""
    return value > baseline.p90 and density_index(value, baseline.median) >= ANOMALY_MIN_INDEX


class RollingHistory:
    """Pembacaan 24 jam terakhir per kamera, sumber baseline sementara dan hitungan anomali."""

    def __init__(self, window: timedelta = WINDOW) -> None:
        self._window = window
        self._values: dict[str, deque[tuple[datetime, float]]] = defaultdict(deque)
        self._exceed_streak: dict[str, int] = defaultdict(int)

    def add(self, camera_id: str, at: datetime, value: float) -> None:
        self._values[camera_id].append((at, value))

    def baseline(self, camera_id: str, now: datetime) -> Baseline | None:
        """Baseline sementara dari pembacaan sebelum `now`, atau None jika datanya belum cukup."""
        values = self._values[camera_id]
        while values and values[0][0] < now - self._window:
            values.popleft()
        if len(values) < MIN_SAMPLES:
            return None
        series = np.array([value for _, value in values], dtype=float)
        return Baseline(
            median=float(np.median(series)),
            p90=float(np.percentile(series, 90)),
            n=len(series),
            provisional=True,
        )

    def is_anomaly(self, camera_id: str, value: float, baseline: Baseline | None) -> bool:
        """Anomali jika pembacaan melampaui baseline selama `ANOMALY_CYCLES` siklus berturut-turut.

        Baseline sementara mencampur siang dan malam, sehingga jam sibuk harian akan selalu
        terlihat "tidak normal". Anomali baru dinilai setelah baseline per jam tersedia.
        """
        if baseline is None or baseline.provisional or not exceeds_baseline(value, baseline):
            self._exceed_streak[camera_id] = 0
            return False
        self._exceed_streak[camera_id] += 1
        return self._exceed_streak[camera_id] >= ANOMALY_CYCLES
