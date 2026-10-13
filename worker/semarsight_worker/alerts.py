"""Peringatan: aturan transparan menentukan peringatan yang seharusnya aktif, lalu tabel `alerts` diselaraskan.

Teks dibuat dari template, bukan LLM, agar cepat dan konsisten. Hanya satu peringatan aktif per
(jenis, kamera); peringatan yang syaratnya tidak lagi terpenuhi ditutup, bukan dihapus.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from .db import Database
from .fusion.upstream import Link, worst_upstream
from .models import CameraRow
from .sources.openmeteo import GridWeather

log = logging.getLogger(__name__)

# Jenis yang dikelola modul ini. Jenis lain di tabel `alerts` tidak disentuh.
MANAGED_TYPES = ("water_rising", "road_flooded", "upstream_warning", "heavy_rain", "trash_blockage", "camera_offline")

ELEVATED = ("waspada", "siaga", "awas")
HEAVY_RAIN_MM = 10.0  # prakiraan 3 jam ke depan yang memunculkan peringatan hujan
VERY_HEAVY_RAIN_MM = 20.0  # naik dari info ke waspada
HEAVY_RAIN_CLEAR_MM = 7.0  # peringatan yang sudah aktif baru ditutup di bawah angka ini, agar tidak kedap-kedip
OFFLINE_AFTER_FAILURES = 6  # 6 siklus berturut-turut = sekitar 30 menit
TREND_TEXT = {"naik_cepat": "naik cepat", "naik": "naik", "stabil": "stabil", "turun": "mulai turun"}
FLOOD_TEXT = {"genangan_ringan": "ringan", "genangan_sedang": "sedang", "genangan_tinggi": "tinggi"}


@dataclass(frozen=True)
class Alert:
    type: str
    level: str
    title: str
    message: str
    camera_id: str | None = None
    audience: tuple[str, ...] = ()
    data: dict[str, Any] = field(default_factory=dict)

    @property
    def key(self) -> tuple[str, str | None]:
        return (self.type, self.camera_id)


@dataclass(frozen=True)
class Changes:
    insert: list[dict[str, Any]]
    update: list[tuple[str, dict[str, Any]]]
    resolve: list[str]


def water_alerts(cameras: list[CameraRow], statuses: dict[str, dict[str, Any]], weather: dict[str, GridWeather]) -> list[Alert]:
    """Satu peringatan per lokasi air yang status terkonfirmasinya waspada ke atas."""
    alerts = []
    for cam in cameras:
        status = statuses.get(cam.id, {})
        level = status.get("water_status")
        if level not in ELEVATED:
            continue
        trend = TREND_TEXT.get(status.get("water_trend") or "")
        local = weather.get(cam.weather_grid_id or "")
        data = {
            "water_status": level,
            "water_trend": status.get("water_trend"),
            "risk_level": status.get("risk_level"),
            "since": status.get("water_status_since"),
            "rain_next_3h_mm": local.precip_next_3h_mm if local else None,
        }
        if cam.water_kind == "jalan":
            depth = FLOOD_TEXT.get(status.get("road_flood") or "")
            alerts.append(
                Alert(
                    type="road_flooded",
                    level=level,
                    camera_id=cam.id,
                    title=f"Genangan di {cam.name}",
                    message=f"Jalan terpantau tergenang{f' ({depth})' if depth else ''}, status {level}{f', {trend}' if trend else ''}.",
                    audience=("bpbd", "dishub", "warga"),
                    data=data | {"road_flood": status.get("road_flood")},
                )
            )
        else:
            alerts.append(
                Alert(
                    type="water_rising",
                    level=level,
                    camera_id=cam.id,
                    title=f"Air {level} di {cam.name}",
                    message=f"Muka air berstatus {level}{f', {trend}' if trend else ''}.",
                    audience=("bpbd", "pu", "warga"),
                    data=data,
                )
            )
    return alerts


def rain_alert(weather: dict[str, GridWeather], *, already_active: bool) -> Alert | None:
    """Satu peringatan hujan untuk seluruh kota, menyebut wilayah yang prakiraannya paling tinggi."""
    threshold = HEAVY_RAIN_CLEAR_MM if already_active else HEAVY_RAIN_MM
    wet = sorted((w for w in weather.values() if w.precip_next_3h_mm >= threshold), key=lambda w: -w.precip_next_3h_mm)
    if not wet:
        return None
    peak = wet[0].precip_next_3h_mm
    places = ", ".join(w.grid_name or w.grid_id for w in wet[:3]) + (f" dan {len(wet) - 3} wilayah lain" if len(wet) > 3 else "")
    return Alert(
        type="heavy_rain",
        level="waspada" if peak >= VERY_HEAVY_RAIN_MM else "info",
        title="Prakiraan hujan lebat",
        message=f"Prakiraan hujan hingga {peak:.0f} mm dalam 3 jam ke depan di {places}.",
        audience=("bpbd", "pu", "warga"),
        data={"peak_mm": peak, "grids": {w.grid_id: w.precip_next_3h_mm for w in wet}, "source": "Open-Meteo"},
    )


def trash_alerts(
    cameras: list[CameraRow],
    statuses: dict[str, dict[str, Any]],
    weather: dict[str, GridWeather],
    already_active: frozenset[str] = frozenset(),
) -> list[Alert]:
    """Sampah banyak di pompa, sungai, atau kolam, sementara hujan lebat diprakirakan: bersihkan sebelum hujan.

    `statuses[...]["trash"]` adalah status sampah resmi (sudah dihaluskan), bukan satu penilaian AI.
    Tingkatnya waspada: ini ajakan bersiap untuk Dinas PU, bukan tanda air sudah naik. Peringatan yang sudah
    aktif (`already_active`, id kamera) baru ditutup di bawah `HEAVY_RAIN_CLEAR_MM`, agar tidak kedap-kedip.
    """
    alerts = []
    for cam in cameras:
        local = weather.get(cam.weather_grid_id or "")
        threshold = HEAVY_RAIN_CLEAR_MM if cam.id in already_active else HEAVY_RAIN_MM
        if cam.water_kind == "jalan" or local is None or local.precip_next_3h_mm < threshold:
            continue
        if statuses.get(cam.id, {}).get("trash") != "banyak":
            continue
        alerts.append(
            Alert(
                type="trash_blockage",
                level="waspada",
                camera_id=cam.id,
                title=f"Sampah menumpuk di {cam.name}",
                message=(
                    f"Sampah terlihat banyak dan hujan {local.precip_next_3h_mm:.0f} mm diprakirakan dalam 3 jam ke depan. "
                    "Bersihkan saringan dan pintu air sebelum hujan agar aliran tidak tersumbat."
                ),
                audience=("pu",),
                data={"trash": "banyak", "rain_next_3h_mm": local.precip_next_3h_mm},
            )
        )
    return alerts


def offline_alerts(cameras: list[CameraRow], statuses: dict[str, dict[str, Any]]) -> list[Alert]:
    """Kamera unggulan yang tidak terbaca sekitar 30 menit: lokasi itu sementara tidak terpantau."""
    alerts = []
    for cam in cameras:
        failures = statuses.get(cam.id, {}).get("consecutive_failures") or 0
        if not cam.is_featured or failures < OFFLINE_AFTER_FAILURES:
            continue
        alerts.append(
            Alert(
                type="camera_offline",
                level="info",
                camera_id=cam.id,
                title=f"Kamera {cam.name} tidak terbaca",
                message="Kamera tidak dapat dibaca lebih dari 30 menit; lokasi ini sementara tidak terpantau.",
                data={"last_live_at": statuses.get(cam.id, {}).get("last_live_at")},
            )
        )
    return alerts


def upstream_alerts(cameras: list[CameraRow], statuses: dict[str, dict[str, Any]], links: list[Link]) -> list[Alert]:
    """Peringatan dini untuk lokasi hilir saat lokasi hulunya waspada ke atas dan sedang naik."""
    by_id = {cam.id: cam for cam in cameras}
    rising = {
        camera_id: status["water_status"]
        for camera_id, status in statuses.items()
        if status.get("water_status") in ELEVATED and status.get("water_trend") in ("naik", "naik_cepat")
    }
    alerts = []
    for downstream_id in dict.fromkeys(link.downstream_id for link in links):
        found = worst_upstream(downstream_id, links, rising)
        if found is None or downstream_id not in by_id or found[0].upstream_id not in by_id:
            continue
        link, level = found
        source, target = by_id[link.upstream_id], by_id[downstream_id]
        trend = TREND_TEXT[statuses[link.upstream_id]["water_trend"]]
        estimate = "" if link.lag_is_learned else " (jeda masih perkiraan awal)"
        alerts.append(
            Alert(
                type="upstream_warning",
                level="waspada",
                camera_id=downstream_id,
                title=f"Peringatan dini untuk {target.name}",
                message=f"Hulu {source.name} berstatus {level} dan {trend}; perkiraan dampak di {target.name} dalam sekitar {link.lag_minutes} menit{estimate}.",
                audience=("bpbd", "pu", "warga"),
                data={"upstream_camera_id": link.upstream_id, "upstream_status": level, "lag_minutes": link.lag_minutes, "lag_is_learned": link.lag_is_learned},
            )
        )
    return alerts


def reconcile(desired: list[Alert], active: list[dict[str, Any]]) -> Changes:
    """Bandingkan peringatan yang seharusnya aktif dengan yang aktif di database."""
    current = {(row["type"], row["camera_id"]): row for row in active}
    insert, update = [], []
    for alert in desired:
        fields = {
            "level": alert.level,
            "title": alert.title,
            "message": alert.message,
            "audience": list(alert.audience),
            "data": alert.data,
        }
        row = current.pop(alert.key, None)
        if row is None:
            insert.append({"type": alert.type, "camera_id": alert.camera_id} | fields)
        elif (row["level"], row["title"], row["message"]) != (alert.level, alert.title, alert.message):
            update.append((row["id"], fields))  # isi yang sama tidak ditulis ulang agar Realtime tidak ramai
    return Changes(insert=insert, update=update, resolve=[row["id"] for row in current.values()])


def sync(database: Database, cameras: list[CameraRow], weather: dict[str, GridWeather], links: list[Link] | None = None) -> Changes:
    """Hitung peringatan dari keadaan terbaru lalu tulis selisihnya. Dipanggil sekali per siklus.

    `cameras` harus berisi semua kamera aktif, bukan hanya yang diproses siklus ini: peringatan
    milik kamera yang tidak ada di daftar dianggap tidak berlaku lagi dan ditutup.
    """
    statuses = database.alert_inputs()
    active = database.active_alerts(MANAGED_TYPES)
    water_cameras = [cam for cam in cameras if "water" in cam.modules and cam.is_calibrated]
    desired = [
        *water_alerts(water_cameras, statuses, weather),
        *trash_alerts(
            water_cameras, statuses, weather, frozenset(row["camera_id"] for row in active if row["type"] == "trash_blockage")
        ),
        *upstream_alerts(water_cameras, statuses, links or []),
        *offline_alerts(cameras, statuses),
    ]
    rain = rain_alert(weather, already_active=any(row["type"] == "heavy_rain" for row in active))
    if rain:
        desired.append(rain)

    changes = reconcile(desired, active)
    database.insert_alerts(changes.insert)
    for alert_id, fields in changes.update:
        database.update_alert(alert_id, fields)
    database.resolve_alerts(changes.resolve, datetime.now(timezone.utc))
    if changes.insert or changes.update or changes.resolve:
        log.info("peringatan: %d baru, %d diperbarui, %d ditutup", len(changes.insert), len(changes.update), len(changes.resolve))
        for row in changes.insert:
            log.info("peringatan baru [%s] %s: %s", row["level"], row["title"], row["message"])
    return changes
