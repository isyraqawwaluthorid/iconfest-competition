"""Tipe data yang dipakai lintas modul worker."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, ConfigDict, Field

from .analyzers.traffic import Counts

if TYPE_CHECKING:
    from .water_pipeline import WaterObservation

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
    weather_grid_id: str | None = None
    # kalibrasi modul air (diisi lewat halaman admin)
    water_kind: str | None = None
    river_system: str | None = None
    roi: dict | None = None
    reference_lines: list[dict] | None = None
    calibration_notes: str | None = None
    reference_image_day: str | None = None
    reference_image_night: str | None = None

    @property
    def is_calibrated(self) -> bool:
        return len((self.roi or {}).get("points", [])) >= 3


WaterStatus = Literal["normal", "waspada", "siaga", "awas", "tidak_dapat_dinilai"]
RoadFlood = Literal[
    "tidak_tergenang", "genangan_ringan", "genangan_sedang", "genangan_tinggi", "tidak_dapat_dinilai", "tidak_relevan"
]
TrashLevel = Literal["tidak_terlihat", "sedikit", "banyak", "tidak_dapat_dinilai", "tidak_relevan"]


class VisionResult(BaseModel):
    """Jawaban AI vision untuk satu frame kamera air; bentuknya sama dengan `ai/schemas/water_vision.schema.json`."""

    model_config = ConfigDict(extra="forbid")

    image_usable: bool
    status: WaterStatus
    road_flood: RoadFlood
    trash: TrashLevel
    water_position: str
    change_vs_reference: Literal["lebih_rendah", "sama", "sedikit_lebih_tinggi", "jauh_lebih_tinggi", "tidak_dapat_dinilai"]
    confidence: float = Field(ge=0, le=1)
    reason: str

    @classmethod
    def failed(cls, failure: str) -> VisionResult:
        """Hasil pengganti saat AI gagal dipanggil atau jawabannya tidak valid."""
        return cls(
            image_usable=False,
            status="tidak_dapat_dinilai",
            road_flood="tidak_dapat_dinilai",
            trash="tidak_dapat_dinilai",
            water_position="",
            change_vs_reference="tidak_dapat_dinilai",
            confidence=0.0,
            reason=f"gagal dianalisis: {failure}"[:200],
        )


class InsightRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    audience: Literal["bpbd", "pu", "dishub", "perencana", "warga"]
    action: str


class InsightItem(BaseModel):
    """Satu kartu insight: Kondisi (`body`) → Penyebab → Dampak → Tindakan."""

    model_config = ConfigDict(extra="forbid")

    title: str
    body: str
    cause: str
    impact: str
    module: Literal["air", "lalu_lintas", "ruang_publik", "lintas_modul", "sistem"]
    level: Literal["info", "waspada", "siaga", "awas"]
    camera_ids: list[str]
    evidence: list[str]
    recommendations: list[InsightRecommendation]


class InsightResult(BaseModel):
    """Jawaban LLM teks; bentuknya sama dengan `ai/schemas/insight.schema.json`."""

    model_config = ConfigDict(extra="forbid")

    headline: str
    summary: str
    overall_level: Literal["aman", "perlu_perhatian", "waspada", "siaga", "awas"]
    items: list[InsightItem]


@dataclass(frozen=True)
class QualityResult:
    quality: Quality
    is_night: bool
    is_ir: bool
    brightness: float
    sharpness: float
    saturation: float
    dark_pct: float


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
    water: WaterObservation | None = None  # terisi jika AI dipanggil untuk kamera ini pada siklus ini
    evidence_path: str | None = None  # gambar yang dinilai AI, di Storage


@dataclass(frozen=True)
class CycleStats:
    started_at: datetime
    duration_ms: int
    live: int
    frozen: int
    dead: int
    unreachable: int = 0  # gagal karena jaringan worker, bukan karena kameranya; tidak dicatat sebagai mati

    @property
    def total(self) -> int:
        return self.live + self.frozen + self.dead + self.unreachable
