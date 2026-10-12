"""Profil aktivitas harian per kamera: rata-rata kendaraan dan orang yang terlihat per gambar, per jam (WIB).

Dipakai lapisan "Aktivitas per jam" di web: seberapa ramai tiap kawasan biasanya pada jam tertentu.
Ini rata-rata dari hitungan yang benar-benar dikumpulkan, bukan perkiraan untuk kawasan tanpa kamera.
Hitungan orang ikut memuat pengendara sepeda motor, karena detektor tidak membedakannya dari pejalan kaki.
"""

from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

WIB = ZoneInfo("Asia/Jakarta")
HOURS = 24
WRITE_EVERY = timedelta(hours=1)
MIN_SAMPLES = 6  # sekitar setengah jam data sebelum rata-rata satu jam dianggap berarti


class Profile:
    """Jumlah berjalan per kamera per jam; diisi dari riwayat saat worker mulai, lalu ditambah tiap siklus."""

    def __init__(self) -> None:
        self._vehicles: dict[str, list[float]] = defaultdict(lambda: [0.0] * HOURS)
        self._persons: dict[str, list[float]] = defaultdict(lambda: [0.0] * HOURS)
        self._samples: dict[str, list[int]] = defaultdict(lambda: [0] * HOURS)
        self._days: set[str] = set()
        self._first: datetime | None = None
        self._written_at: datetime | None = None

    def add(self, camera_id: str, at: datetime, vehicles: float, persons: float) -> None:
        local = at.astimezone(WIB)
        self._vehicles[camera_id][local.hour] += vehicles
        self._persons[camera_id][local.hour] += persons
        self._samples[camera_id][local.hour] += 1
        self._days.add(local.date().isoformat())
        if self._first is None or at < self._first:
            self._first = at

    def due(self, now: datetime) -> bool:
        """Sudah waktunya ditulis lagi: belum pernah, atau sudah lewat satu jam."""
        return self._written_at is None or now - self._written_at >= WRITE_EVERY

    def mark_written(self, now: datetime) -> None:
        self._written_at = now

    def snapshot(self, now: datetime) -> dict[str, Any]:
        """Isi yang disimpan untuk web. Jam dengan terlalu sedikit data ditulis `None`, bukan nol."""

        def averages(totals: list[float], samples: list[int]) -> list[float | None]:
            return [round(total / n, 1) if n >= MIN_SAMPLES else None for total, n in zip(totals, samples)]

        return {
            "generated_at": now.isoformat(timespec="seconds"),
            "since": self._first.isoformat(timespec="seconds") if self._first else None,
            "days": len(self._days),
            "cameras": {
                camera_id: {
                    "vehicles": averages(self._vehicles[camera_id], samples),
                    "persons": averages(self._persons[camera_id], samples),
                }
                for camera_id, samples in sorted(self._samples.items())
            },
        }
