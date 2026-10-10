"""Tipe data yang dipakai lintas modul worker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict

from .analyzers.traffic import Counts

Health = Literal["live", "frozen", "dead"]
Quality = Literal["good", "fair", "poor"]


class CameraRow(BaseModel):
    """Baris tabel `cameras`; kolom yang belum dipakai worker diabaikan."""

    model_config = ConfigDict(extra="ignore")

    id: str
    source_link_id: int
    name: str
    modules: list[str] = []
    stream_url: str
    is_featured: bool = False
    traffic_roi: dict | None = None


@dataclass(frozen=True)
class QualityResult:
    quality: Quality
    is_night: bool
    brightness: float
    sharpness: float
    saturation: float


@dataclass(frozen=True)
class FrameState:
    """Jejak frame terakhir satu kamera, untuk mendeteksi gambar beku antar siklus."""

    hash: int
    still_cycles: int


@dataclass(frozen=True)
class TrafficReading:
    """Hitungan YOLO satu frame beserta posisinya terhadap baseline kamera itu sendiri."""

    counts: Counts
    density_index: float | None
    density_level: str
    baseline_median: float | None
    baseline_is_provisional: bool
    is_anomaly: bool


@dataclass
class CameraResult:
    """Hasil memproses satu kamera dalam satu siklus."""

    camera: CameraRow
    checked_at: datetime
    health: Health
    latency_ms: int | None = None
    error: str | None = None
    quality: QualityResult | None = None
    local_path: Path | None = None
    snapshot_path: str | None = None
    frame_state: FrameState | None = None
    counts: Counts | None = None
    traffic: TrafficReading | None = None


@dataclass(frozen=True)
class CycleStats:
    started_at: datetime
    duration_ms: int
    live: int
    frozen: int
    dead: int

    @property
    def total(self) -> int:
        return self.live + self.frozen + self.dead
