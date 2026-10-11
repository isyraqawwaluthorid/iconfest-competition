from datetime import datetime, timedelta, timezone

import cv2
import numpy as np
import pytest

from semarsight_worker import quality

WIB = timezone(timedelta(hours=7))
NOON = datetime(2026, 10, 11, 12, 0, tzinfo=WIB)
LATE_EVENING = datetime(2026, 10, 10, 21, 30, tzinfo=WIB)


def _textured(brightness: int, *, color: bool = True) -> np.ndarray:
    """Gambar papan catur berwarna: tajam, dengan kecerahan rata-rata terkendali."""
    tile = np.indices((240, 320)).sum(axis=0) // 8 % 2
    value = np.where(tile == 1, min(brightness + 40, 255), max(brightness - 40, 0)).astype(np.uint8)
    saturation = np.full_like(value, 160 if color else 0)
    hue = np.full_like(value, 100)
    return cv2.cvtColor(cv2.merge([hue, saturation, value]), cv2.COLOR_HSV2BGR)


@pytest.mark.parametrize(
    ("local_time", "expected_night"),
    [("12:00", False), ("05:00", True), ("05:45", False), ("17:15", False), ("18:00", True), ("23:30", True)],
)
def test_night_follows_the_sun_in_semarang(local_time, expected_night):
    hour, minute = map(int, local_time.split(":"))
    at = datetime(2026, 10, 11, hour, minute, tzinfo=WIB)
    assert quality.is_night(at) is expected_night


def test_sun_is_high_at_local_noon_and_far_below_at_midnight():
    assert quality.sun_elevation_deg(datetime(2026, 10, 11, 11, 30, tzinfo=WIB)) > 80
    assert quality.sun_elevation_deg(datetime(2026, 10, 11, 0, 0, tzinfo=WIB)) < -60


def test_bright_night_frame_is_still_night():
    """Auto-exposure membuat frame malam tetap terang; waktu yang menentukan, bukan kecerahan."""
    result = quality.assess(_textured(150), LATE_EVENING)
    assert result.is_night is True
    assert result.quality == "good"


def test_dark_daytime_frame_is_not_night():
    assert quality.assess(_textured(60), NOON).is_night is False


def test_sharp_colour_frame_is_good():
    result = quality.assess(_textured(150), NOON)
    assert result.quality == "good"
    assert result.is_ir is False


def test_mostly_black_frame_is_poor():
    frame = _textured(150)
    frame[:200] = 0  # lebih dari 60% piksel gelap
    assert quality.assess(frame, LATE_EVENING).quality == "poor"


def test_blurred_frame_is_poor():
    blurred = cv2.GaussianBlur(_textured(150), (51, 51), 0)
    assert quality.assess(blurred, NOON).quality == "poor"


def test_infrared_frame_is_fair_and_flagged():
    result = quality.assess(_textured(150, color=False), LATE_EVENING)
    assert result.is_ir is True
    assert result.quality == "fair"
