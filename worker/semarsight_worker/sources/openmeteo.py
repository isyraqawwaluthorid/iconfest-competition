"""Curah hujan dari Open-Meteo untuk titik-titik grid cuaca kota (gratis, tanpa API key)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

import httpx

FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
TIMEOUT_SECONDS = 30
HOURS_KEPT = 12  # jam prakiraan mentah yang ikut disimpan


@dataclass(frozen=True)
class GridPoint:
    id: str
    lat: float
    lng: float


@dataclass(frozen=True)
class GridWeather:
    grid_id: str
    precip_now_mm: float
    precip_next_1h_mm: float
    precip_next_3h_mm: float
    precip_next_6h_mm: float
    precip_prob_max_3h: float | None
    hourly: list[dict[str, Any]]

    @property
    def rain_for_trigger_mm(self) -> float:
        """Hujan yang relevan untuk mempercepat pemeriksaan air: saat ini atau satu jam ke depan."""
        return max(self.precip_now_mm, self.precip_next_1h_mm)


def summarize(grid_id: str, payload: dict[str, Any], now: datetime) -> GridWeather:
    """Ringkas jawaban Open-Meteo satu titik (waktu dalam detik epoch) menjadi angka yang dipakai sistem.

    Nilai per jam Open-Meteo adalah total satu jam sebelum cap waktunya, jadi "1 jam ke depan"
    adalah slot pertama yang cap waktunya sesudah `now`.
    """
    hourly = payload.get("hourly") or {}
    times = hourly.get("time") or []
    rain = hourly.get("precipitation") or []
    probability = hourly.get("precipitation_probability") or []
    ahead = [i for i, t in enumerate(times) if t > now.timestamp()]

    def total(hours: int) -> float:
        return round(sum(rain[i] or 0.0 for i in ahead[:hours]), 2)

    probabilities = [probability[i] for i in ahead[:3] if i < len(probability) and probability[i] is not None]
    return GridWeather(
        grid_id=grid_id,
        precip_now_mm=float((payload.get("current") or {}).get("precipitation") or 0.0),
        precip_next_1h_mm=total(1),
        precip_next_3h_mm=total(3),
        precip_next_6h_mm=total(6),
        precip_prob_max_3h=float(max(probabilities)) if probabilities else None,
        hourly=[
            {
                "time": times[i],
                "precipitation": rain[i],
                "probability": probability[i] if i < len(probability) else None,
            }
            for i in ahead[:HOURS_KEPT]
        ],
    )


def fetch_grid_weather(points: list[GridPoint], now: datetime) -> list[GridWeather]:
    """Ambil cuaca semua titik grid dalam satu permintaan."""
    if not points:
        return []
    response = httpx.get(
        FORECAST_URL,
        params={
            "latitude": ",".join(str(p.lat) for p in points),
            "longitude": ",".join(str(p.lng) for p in points),
            "current": "precipitation",
            "hourly": "precipitation,precipitation_probability",
            "forecast_days": 2,
            "timeformat": "unixtime",
            "timezone": "UTC",
        },
        timeout=TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    body = response.json()
    payloads = body if isinstance(body, list) else [body]  # satu titik dijawab sebagai objek, bukan daftar
    return [summarize(point.id, payload, now) for point, payload in zip(points, payloads, strict=True)]
