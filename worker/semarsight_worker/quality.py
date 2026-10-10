"""Penilaian kualitas gambar: kecerahan, ketajaman, dan mode malam.

Ambang awal mengikuti docs/05-worker-spec.md dan perlu dikalibrasi ulang dari sampel nyata.
"""

from __future__ import annotations

import cv2
import numpy as np

from .models import Quality, QualityResult

NIGHT_BRIGHTNESS = 70.0
NIGHT_SATURATION = 20.0  # di bawah ini kamera hampir pasti dalam mode IR hitam-putih
POOR_BRIGHTNESS = 35.0
POOR_SHARPNESS = 30.0
FAIR_BRIGHTNESS = 70.0
FAIR_SHARPNESS = 80.0


def assess(frame: np.ndarray) -> QualityResult:
    """Nilai kualitas satu frame BGR."""
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    brightness = float(hsv[:, :, 2].mean())
    saturation = float(hsv[:, :, 1].mean())
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())

    quality: Quality
    if brightness < POOR_BRIGHTNESS or sharpness < POOR_SHARPNESS:
        quality = "poor"
    elif brightness < FAIR_BRIGHTNESS or sharpness < FAIR_SHARPNESS:
        quality = "fair"
    else:
        quality = "good"

    return QualityResult(
        quality=quality,
        is_night=brightness < NIGHT_BRIGHTNESS or saturation < NIGHT_SATURATION,
        brightness=round(brightness, 1),
        sharpness=round(sharpness, 1),
        saturation=round(saturation, 1),
    )
