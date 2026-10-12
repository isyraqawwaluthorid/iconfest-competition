"""Baseline kepadatan per kamera dan indeks kepadatan relatif.

Setiap kamera dibandingkan dengan dirinya sendiri pada jam yang sama di hari-hari sebelumnya
(jendela ±1 jam), dengan mengutamakan jenis hari yang sama (hari kerja atau akhir pekan).
Pembanding dari kurang dari tiga hari ditandai sementara, dan anomali belum dinilai darinya.
"""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

import numpy as np

WIB = ZoneInfo("Asia/Jakarta")  # jam sibuk mengikuti waktu setempat
HISTORY = timedelta(days=14)
SLOT_MINUTES = 5
SLOTS_PER_DAY = 24 * 60 // SLOT_MINUTES
WINDOW_SLOTS = 60 // SLOT_MINUTES  # ±1 jam di sekitar jam yang dinilai
MIN_AGE = timedelta(hours=6)  # pembacaan hari yang sama tidak ikut: kondisi sekarang tidak dibandingkan dengan dirinya
MIN_SAMPLES = 12  # sekitar 1 jam data sebelum indeks dianggap bermakna
MIN_DAYS = 3  # hari berbeda sebelum pembanding tidak lagi sementara
LEVEL_UPPER_BOUNDS = ((0.8, "lancar"), (1.3, "normal"), (1.8, "ramai"))
TOP_LEVEL = "padat"
UNKNOWN_LEVEL = "tidak_diketahui"
CALM_LEVEL = "normal"
BUSY_LEVELS = ("ramai", TOP_LEVEL)
# Di bawah jumlah ini jalan belum disebut ramai, berapa pun kelipatannya dari kebiasaan: 4 kendaraan pada jam
# yang biasanya 1 memang empat kali lipat, tetapi jalannya tetap lengang.
MIN_BUSY_COUNT = 8
ANOMALY_MIN_INDEX = 1.5
ANOMALY_CYCLES = 2


@dataclass(frozen=True)
class Baseline:
    median: float
    p90: float
    n: int
    provisional: bool
    days: int = 0  # jumlah hari berbeda yang menyumbang pembacaan


def density_index(value: float, median: float) -> float:
    return value / max(median, 1.0)


def density_level(index: float | None, value: float | None = None) -> str:
    """Tingkat kepadatan dari indeks; `value` (jumlah terlihat) menahan tingkat di atas normal bila masih sedikit."""
    if index is None:
        return UNKNOWN_LEVEL
    level = next((name for upper, name in LEVEL_UPPER_BOUNDS if index < upper), TOP_LEVEL)
    if level in BUSY_LEVELS and value is not None and value < MIN_BUSY_COUNT:
        return CALM_LEVEL
    return level


def exceeds_baseline(value: float, baseline: Baseline) -> bool:
    """Satu pembacaan melampaui pola normal: di atas p90, indeks >= 1,5, dan jumlahnya tidak sedikit."""
    return value >= MIN_BUSY_COUNT and value > baseline.p90 and density_index(value, baseline.median) >= ANOMALY_MIN_INDEX


class History:
    """Pembacaan 14 hari terakhir per kamera, dikelompokkan per slot 5 menit dalam sehari (WIB)."""

    def __init__(self, keep: timedelta = HISTORY) -> None:
        self._keep = keep
        self._slots: dict[str, list[deque[tuple[datetime, float]]]] = defaultdict(lambda: [deque() for _ in range(SLOTS_PER_DAY)])
        self._exceed_streak: dict[str, int] = defaultdict(int)

    def add(self, camera_id: str, at: datetime, value: float) -> None:
        """Catat satu pembacaan. Pembacaan harus ditambahkan berurutan waktu per kamera."""
        slot = self._slots[camera_id][_slot(at)]
        slot.append((at, value))
        while slot[0][0] < at - self._keep:
            slot.popleft()

    def baseline(self, camera_id: str, now: datetime) -> Baseline | None:
        """Pembanding untuk `now`: jam yang sama di hari-hari sebelumnya, atau None jika datanya belum cukup."""
        slots = self._slots[camera_id]
        center = _slot(now)
        oldest, newest = now - self._keep, now - MIN_AGE
        sample = [
            (at, value)
            for offset in range(-WINDOW_SLOTS, WINDOW_SLOTS + 1)
            for at, value in slots[(center + offset) % SLOTS_PER_DAY]
            if oldest <= at <= newest
        ]
        # Hari kerja dan akhir pekan punya pola berbeda; jenis hari yang sama dipakai bila datanya cukup.
        same_kind = [(at, value) for at, value in sample if _is_weekend(at) == _is_weekend(now)]
        matched = len(same_kind) >= MIN_SAMPLES
        if matched:
            sample = same_kind
        if len(sample) < MIN_SAMPLES:
            return None
        series = np.array([value for _, value in sample], dtype=float)
        days = len({at.astimezone(WIB).date() for at, _ in sample})
        return Baseline(
            median=float(np.median(series)),
            p90=float(np.percentile(series, 90)),
            n=len(series),
            provisional=not matched or days < MIN_DAYS,
            days=days,
        )

    def is_anomaly(self, camera_id: str, value: float, baseline: Baseline | None) -> bool:
        """Anomali jika pembacaan melampaui baseline selama `ANOMALY_CYCLES` siklus berturut-turut.

        Pembanding sementara berasal dari terlalu sedikit hari (atau dari jenis hari yang berbeda),
        sehingga hari yang sekadar lebih ramai akan terlihat "tidak normal". Anomali belum dinilai darinya.
        """
        if baseline is None or baseline.provisional or not exceeds_baseline(value, baseline):
            self._exceed_streak[camera_id] = 0
            return False
        self._exceed_streak[camera_id] += 1
        return self._exceed_streak[camera_id] >= ANOMALY_CYCLES


def _slot(at: datetime) -> int:
    local = at.astimezone(WIB)
    return (local.hour * 60 + local.minute) // SLOT_MINUTES


def _is_weekend(at: datetime) -> bool:
    return at.astimezone(WIB).weekday() >= 5
