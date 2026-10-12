"""Alur modul air per siklus: kapan AI dipanggil, lalu bagaimana jawabannya menjadi status resmi.

`observe` berjalan di thread tiap kamera (deteksi perubahan dan, bila perlu, panggilan AI).
`commit` berjalan sekali per siklus di thread utama (simpan pembacaan, haluskan status).
"""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import cv2
import numpy as np

from .analyzers import water
from .config import Settings
from .db import Database
from .fusion import risk, smoothing, trend, upstream
from .models import CameraResult, CameraRow, QualityResult, VisionResult
from .sources.openmeteo import GridWeather

log = logging.getLogger(__name__)

WIB = ZoneInfo("Asia/Jakarta")
RECENT_SCORES = 12  # skor perubahan terakhir yang dipakai untuk mengenali variasi normal kamera
READINGS_FOR_SMOOTHING = 16  # cukup untuk menjangkau 60 menit ke belakang saat pemicu sedang rapat
REFERENCE_CACHE_SECONDS = 3600


@dataclass(frozen=True)
class WaterObservation:
    """Satu penilaian AI atas satu frame, beserta alasan pemanggilannya."""

    trigger: str
    change: float | None
    result: VisionResult
    raw: dict


class WaterPipeline:
    def __init__(self, settings: Settings, database: Database, weather: dict[str, GridWeather]) -> None:
        self._settings = settings
        self._database = database
        self._weather = weather  # cuaca terbaru per titik grid; diisi oleh job cuaca
        self._last_call: dict[str, datetime] = {}
        self._last_view: dict[str, water.RegionView] = {}
        self._scores: dict[str, deque[float]] = defaultdict(lambda: deque(maxlen=RECENT_SCORES))
        self._levels: dict[str, list[tuple[datetime, int]]] = {}  # riwayat level per kamera, terbaru dulu
        self._references: dict[str, tuple[float, np.ndarray | None]] = {}
        self.links: list[upstream.Link] = []  # hubungan hulu → hilir; dibaca ulang tiap siklus
        self._lock = threading.Lock()
        self._calls_day: date | None = None
        self._calls_today = 0
        self.enabled = bool(
            settings.ai_vision_enabled
            and settings.openai_api_key
            and settings.openai_vision_model
            and not database.dry_run
        )
        if self.enabled:
            self._last_call = database.latest_water_call_times()
            self._count_calls(datetime.now(WIB))  # agar detak worker langsung melaporkan angka yang benar

    @property
    def calls_today(self) -> int:
        return self._calls_today

    def eligible(self, cam: CameraRow) -> bool:
        return (
            self.enabled
            and "water" in cam.modules
            and cam.is_calibrated
            and (cam.is_featured or not self._settings.water_only_featured)
        )

    def observe(self, cam: CameraRow, frame: np.ndarray, quality: QualityResult, at: datetime) -> WaterObservation | None:
        """Nilai apakah area air berubah; panggil AI jika ada pemicu dan jatah harian masih ada."""
        settings = self._settings
        view = water.region_view(frame, cam)
        previous = self._last_view.get(cam.id)
        change = water.change_score(view, previous)
        if previous is None:
            self._last_view[cam.id] = view  # pembanding awal sampai ada panggilan AI pertama
        scores = self._scores[cam.id]
        local_weather = self._weather.get(cam.weather_grid_id or "")
        trigger = water.should_call_ai(
            now=at,
            last_call_at=self._last_call.get(cam.id),
            change=change,
            rain_mm=local_weather.rain_for_trigger_mm if local_weather else None,
            change_threshold=water.change_threshold_for(settings.water_change_threshold, list(scores)),
            heartbeat_minutes=settings.water_heartbeat_minutes,
            rain_heartbeat_minutes=settings.water_rain_heartbeat_minutes,
            rain_trigger_mm=settings.rain_trigger_mm,
        )
        if change is not None:
            scores.append(change)
        if trigger is None or not self._take_call_slot(at):
            return None

        result, raw = water.classify_with_ai(
            frame,
            self._reference(cam, quality.is_night),
            cam,
            quality,
            at,
            api_key=settings.openai_api_key,
            model=settings.openai_vision_model,
        )
        self._last_call[cam.id] = at
        self._last_view[cam.id] = view
        return WaterObservation(trigger=trigger, change=change, result=result, raw=raw)

    def commit(self, results: list[CameraResult], previous_status: dict[str, dict[str, Any]]) -> dict[str, dict[str, Any]]:
        """Simpan pembacaan siklus ini dan kembalikan kolom `camera_status` yang berubah, per kamera."""
        try:
            self.links = upstream.links_from_rows(self._database.river_links())
        except Exception:  # noqa: BLE001 - hubungan terakhir yang diketahui tetap dipakai
            log.exception("hubungan hulu-hilir gagal dibaca")
        names = {result.camera.id: result.camera.name for result in results}
        # Status terkonfirmasi semua lokasi setelah siklus ini; diisi di putaran pertama, dipakai untuk kondisi hulu.
        confirmed_now = {camera_id: row.get("water_status") for camera_id, row in previous_status.items()}
        updates: dict[str, dict[str, Any]] = {}
        for result in results:
            observation = result.water
            if observation is None:
                continue
            cam, vision = result.camera, observation.result
            # Penghalusan dihitung sebelum pembacaan disimpan, supaya hasilnya ikut tercatat di baris itu:
            # level yang dihitung dari pembacaan ini (None jika diabaikan) dan status resmi sebelum dan sesudahnya.
            # Web menggambar linimasa dari catatan ini, tanpa mengulang aturannya.
            image_quality = result.quality.quality if result.quality else None
            latest = smoothing.Reading(vision.status, vision.road_flood, vision.confidence, image_quality, vision.change_vs_reference)
            readings = [latest, *self._load_readings(cam)]
            level = smoothing.level_of(latest, cam.water_kind)
            if level is not None:
                self._levels[cam.id].insert(0, (result.checked_at, level))
            before = previous_status.get(cam.id, {})
            confirmed, needs_verification = smoothing.confirm_water_status(before.get("water_status"), readings, cam.water_kind)
            outcome = {
                "level": smoothing.LEVELS[level] if level is not None else None,
                "previous": before.get("water_status"),
                "confirmed": confirmed,
            }
            self._database.insert_water_reading(
                {
                    "camera_id": cam.id,
                    "captured_at": result.checked_at.isoformat(),
                    "status": vision.status,
                    "road_flood": vision.road_flood,
                    "trash": vision.trash,
                    "water_position": vision.water_position[:120],
                    "confidence": vision.confidence,
                    "reason": vision.reason[:200],
                    "trigger": observation.trigger,
                    "change_score": observation.change,
                    "quality": image_quality,
                    "is_night": result.quality.is_night if result.quality else None,
                    "snapshot_path": result.evidence_path,
                    "model": self._settings.openai_vision_model,
                    "raw": observation.raw | {"smoothing": outcome},
                }
            )

            update: dict[str, Any] = {
                "water_status": confirmed,
                "road_flood": vision.road_flood,
                "trash": vision.trash,
                "water_confidence": vision.confidence,
                "needs_verification": needs_verification,
            }
            if confirmed != before.get("water_status"):
                update["water_status_since"] = result.checked_at.isoformat()
                log.info("%s: status air %s -> %s", cam.name, before.get("water_status"), confirmed)
            updates[cam.id] = update
            confirmed_now[cam.id] = confirmed

        # Tren dan risiko bergantung pada waktu, prakiraan hujan, dan kondisi hulu, jadi dihitung ulang setiap
        # siklus walau AI tidak dipanggil. Kamera yang sedang mati dilewati: status airnya sudah tidak segar.
        for result in results:
            cam = result.camera
            if cam.id not in updates and (result.health != "live" or not self.eligible(cam)):
                continue
            confirmed = confirmed_now.get(cam.id)
            if confirmed is None and cam.id not in updates:
                continue
            if cam.id not in self._levels:
                self._load_readings(cam)
            above = upstream.worst_upstream(cam.id, self.links, confirmed_now)
            outlook = self._outlook(cam, confirmed, result.checked_at, above[1] if above else None)
            if above and outlook["risk_components"]:
                outlook["risk_components"]["inputs"]["upstream_name"] = names.get(above[0].upstream_id)
            updates[cam.id] = updates.get(cam.id, {}) | outlook
        return updates

    def _load_readings(self, cam: CameraRow) -> list[smoothing.Reading]:
        """Pembacaan AI terbaru kamera ini (terbaru dulu); sekaligus menyegarkan riwayat level untuk tren."""
        rows = self._database.recent_water_readings(cam.id, READINGS_FOR_SMOOTHING)
        readings = [
            smoothing.Reading(
                status=row["status"],
                road_flood=row["road_flood"],
                confidence=row["confidence"] or 0.0,
                quality=row["quality"],
                change_vs_reference=((row.get("raw") or {}).get("output") or {}).get("change_vs_reference"),
            )
            for row in rows
        ]
        self._levels[cam.id] = [
            (datetime.fromisoformat(row["captured_at"]), level)
            for row, reading in zip(rows, readings, strict=True)
            if (level := smoothing.level_of(reading, cam.water_kind)) is not None
        ]
        return readings

    def _outlook(self, cam: CameraRow, confirmed: str | None, at: datetime, upstream_status: str | None) -> dict[str, Any]:
        """Tren dan skor risiko satu lokasi dari status terkonfirmasi, riwayat level, kondisi hulu, dan prakiraan hujan."""
        confirmed_level = smoothing.LEVELS.index(confirmed) if confirmed in smoothing.LEVELS else None
        water_trend = trend.water_trend(confirmed_level, self._levels.get(cam.id, []), at)
        local_weather = self._weather.get(cam.weather_grid_id or "")
        rain_next_3h = local_weather.precip_next_3h_mm if local_weather else None
        assessed = risk.risk_score(confirmed, water_trend, upstream_status, rain_next_3h)
        return {
            "water_trend": water_trend,
            "risk_score": assessed.score if assessed else None,
            "risk_level": assessed.level if assessed else None,
            "risk_components": assessed.components if assessed else None,
        }

    def _take_call_slot(self, at: datetime) -> bool:
        """Jatah panggilan AI harian (hari kalender WIB). Dihitung ulang dari database saat hari berganti."""
        with self._lock:
            self._count_calls(at)
            if self._calls_today >= self._settings.ai_daily_call_cap:
                log.warning("batas harian panggilan AI (%d) tercapai", self._settings.ai_daily_call_cap)
                return False
            self._calls_today += 1
            return True

    def _count_calls(self, at: datetime) -> None:
        """Pada pergantian hari (atau saat worker baru mulai), hitung ulang panggilan hari ini dari database."""
        today = at.astimezone(WIB).date()
        if today != self._calls_day:
            start = datetime(today.year, today.month, today.day, tzinfo=WIB)
            self._calls_today = self._database.water_calls_since(start)
            self._calls_day = today

    def _reference(self, cam: CameraRow, is_night: bool) -> np.ndarray | None:
        """Foto referensi kondisi normal yang sesuai waktu (siang atau malam), dengan cadangan yang satunya."""
        candidates = [cam.reference_image_night, cam.reference_image_day] if is_night else [cam.reference_image_day, cam.reference_image_night]
        for path in filter(None, candidates):
            cached = self._references.get(path)
            if cached is None or time.monotonic() - cached[0] > REFERENCE_CACHE_SECONDS:
                image = None
                try:
                    data = self._database.download_object(path)
                    image = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
                except Exception as exc:  # noqa: BLE001 - tanpa referensi, AI tetap bisa menilai
                    log.warning("%s: foto referensi %s gagal diunduh: %s", cam.name, path, exc)
                cached = (time.monotonic(), image)
                self._references[path] = cached
            if cached[1] is not None:
                return cached[1]
        return None
