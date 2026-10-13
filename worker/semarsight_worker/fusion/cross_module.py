"""Lintas modul: keadaan lalu lintas di sekitar lokasi air yang statusnya naik (genangan → lalu lintas).

Yang dihitung hanya apa yang terlihat bersamaan: berapa titik lalu lintas dalam radius 1 km yang sedang lebih
padat dari kebiasaannya. Ini bukan bukti sebab-akibat; insight menyebutnya "bersamaan dengan", bukan "karena".
Titik yang pembandingnya masih sementara tetap dihitung tetapi ditandai, supaya tidak dijadikan kesimpulan.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import median
from typing import Any

from ..models import CameraRow

RADIUS_M = 1000.0
MIN_CAMERAS = 2  # satu titik saja terlalu sedikit untuk menyebut keadaan "di sekitar" sebuah lokasi
BUSY_LEVELS = ("ramai", "padat")
RAISED_STATUS = ("waspada", "siaga", "awas")
FLOODED = ("genangan_ringan", "genangan_sedang", "genangan_tinggi")
EARTH_M = 6_371_000.0


@dataclass(frozen=True)
class NearbyTraffic:
    cameras: int  # titik lalu lintas hidup yang punya indeks, dalam radius
    busy: int  # di antaranya yang ramai atau padat
    median_index: float
    busiest_id: str
    busiest_name: str
    busiest_index: float
    busiest_level: str
    provisional: bool  # ada pembanding yang masih sementara: belum layak disimpulkan

    def as_fact(self) -> dict[str, Any]:
        """Bentuk yang dikirim ke LLM insight dan disimpan di `events.traffic_impact`."""
        return {
            "radius_m": int(RADIUS_M),
            "cameras": self.cameras,
            "busier_than_usual": self.busy,
            "median_index": self.median_index,
            "busiest": {"camera_id": self.busiest_id, "name": self.busiest_name, "density_index": self.busiest_index, "level": self.busiest_level},
            "baseline": "sementara" if self.provisional else "per_jam",
        }


def is_raised(status: dict[str, Any]) -> bool:
    """Lokasi air yang status resminya di atas normal, atau jalan yang tergenang."""
    return status.get("water_status") in RAISED_STATUS or status.get("road_flood") in FLOODED


def distance_m(a: CameraRow, b: CameraRow) -> float | None:
    if None in (a.lat, a.lng, b.lat, b.lng):
        return None
    lat1, lat2 = math.radians(a.lat), math.radians(b.lat)
    dlat, dlng = lat2 - lat1, math.radians(b.lng - a.lng)
    h = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_M * math.asin(math.sqrt(h))


def nearby_traffic(
    site: CameraRow, cameras: list[CameraRow], statuses: dict[str, dict[str, Any]], radius_m: float = RADIUS_M
) -> NearbyTraffic | None:
    """Keadaan titik lalu lintas di sekitar `site` (termasuk `site` sendiri bila ia juga kamera lalu lintas)."""
    near = []
    for cam in cameras:
        status = statuses.get(cam.id) or {}
        if "traffic" not in cam.modules or status.get("health") != "live" or status.get("density_index") is None:
            continue
        distance = distance_m(site, cam)
        if distance is not None and distance <= radius_m:
            near.append((cam, status))
    if len(near) < MIN_CAMERAS:
        return None
    busiest_cam, busiest = max(near, key=lambda item: item[1]["density_index"])
    return NearbyTraffic(
        cameras=len(near),
        busy=sum(status.get("density_level") in BUSY_LEVELS for _, status in near),
        median_index=round(median(status["density_index"] for _, status in near), 2),
        busiest_id=busiest_cam.id,
        busiest_name=busiest_cam.name,
        busiest_index=round(busiest["density_index"], 2),
        busiest_level=busiest.get("density_level") or "tidak_diketahui",
        provisional=any(status.get("baseline_is_provisional") for _, status in near),
    )


def worse_impact(previous: dict[str, Any] | None, current: dict[str, Any]) -> dict[str, Any]:
    """Dampak yang disimpan pada kejadian: keadaan terpadat selama kejadian berlangsung."""
    if previous and (previous.get("median_index") or 0) >= current["median_index"]:
        return previous
    return current
