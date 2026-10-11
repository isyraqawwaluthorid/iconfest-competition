"""Penilaian kualitas gambar: ketajaman, proporsi gelap, mode inframerah, dan siang/malam.

Malam ditentukan dari posisi matahari, bukan kecerahan gambar: kamera memakai auto-exposure,
sehingga kecerahan rata-rata frame malam (median 102 pada uji 10 Okt 2026) hampir sama dengan
siang (median 127). Ambang lain dikalibrasi dari arsip frame siang dan malam yang sama.
"""

from __future__ import annotations

import math
from datetime import datetime, timezone

import cv2
import numpy as np

from .models import Quality, QualityResult

SEMARANG_LAT, SEMARANG_LNG = -6.99, 110.42
NIGHT_SUN_ELEVATION_DEG = 0.0  # matahari di bawah cakrawala
IR_SATURATION = 15.0  # di bawah ini kamera dalam mode inframerah hitam-putih
DARK_LUMINANCE = 25  # piksel dengan luminans di bawah ini dihitung "gelap"
POOR_SHARPNESS = 30.0
POOR_DARK_PCT = 60.0
FAIR_SHARPNESS = 80.0
FAIR_DARK_PCT = 35.0


def sun_elevation_deg(at: datetime, lat: float = SEMARANG_LAT, lng: float = SEMARANG_LNG) -> float:
    """Ketinggian matahari di atas cakrawala (derajat), pendekatan NOAA; cukup teliti untuk siang/malam."""
    utc = at.astimezone(timezone.utc)
    hours = utc.hour + utc.minute / 60 + utc.second / 3600
    gamma = 2 * math.pi / 365 * (utc.timetuple().tm_yday - 1 + (hours - 12) / 24)
    equation_of_time = 229.18 * (
        0.000075
        + 0.001868 * math.cos(gamma)
        - 0.032077 * math.sin(gamma)
        - 0.014615 * math.cos(2 * gamma)
        - 0.040849 * math.sin(2 * gamma)
    )
    declination = (
        0.006918
        - 0.399912 * math.cos(gamma)
        + 0.070257 * math.sin(gamma)
        - 0.006758 * math.cos(2 * gamma)
        + 0.000907 * math.sin(2 * gamma)
        - 0.002697 * math.cos(3 * gamma)
        + 0.00148 * math.sin(3 * gamma)
    )
    true_solar_minutes = hours * 60 + equation_of_time + 4 * lng
    hour_angle = math.radians(true_solar_minutes / 4 - 180)
    lat_rad = math.radians(lat)
    cos_zenith = math.sin(lat_rad) * math.sin(declination) + math.cos(lat_rad) * math.cos(declination) * math.cos(
        hour_angle
    )
    return 90 - math.degrees(math.acos(max(-1.0, min(1.0, cos_zenith))))


def is_night(at: datetime) -> bool:
    return sun_elevation_deg(at) < NIGHT_SUN_ELEVATION_DEG


def assess(frame: np.ndarray, at: datetime) -> QualityResult:
    """Nilai kualitas satu frame BGR yang diambil pada waktu `at`."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    brightness = float(hsv[:, :, 2].mean())
    saturation = float(hsv[:, :, 1].mean())
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    dark_pct = float((gray < DARK_LUMINANCE).mean() * 100)
    is_ir = saturation < IR_SATURATION

    quality: Quality
    if sharpness < POOR_SHARPNESS or dark_pct > POOR_DARK_PCT:
        quality = "poor"
    elif sharpness < FAIR_SHARPNESS or dark_pct > FAIR_DARK_PCT or is_ir:
        quality = "fair"
    else:
        quality = "good"

    return QualityResult(
        quality=quality,
        is_night=is_night(at),
        is_ir=is_ir,
        brightness=round(brightness, 1),
        sharpness=round(sharpness, 1),
        saturation=round(saturation, 1),
        dark_pct=round(dark_pct, 1),
    )
