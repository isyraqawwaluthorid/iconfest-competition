import cv2
import numpy as np

from semarsight_worker import quality


def _textured(brightness: int, *, color: bool = True) -> np.ndarray:
    """Gambar papan catur berwarna: tajam, dengan kecerahan rata-rata terkendali."""
    tile = np.indices((240, 320)).sum(axis=0) // 8 % 2
    value = np.where(tile == 1, min(brightness + 40, 255), max(brightness - 40, 0)).astype(np.uint8)
    saturation = np.full_like(value, 160 if color else 0)
    hue = np.full_like(value, 100)
    return cv2.cvtColor(cv2.merge([hue, saturation, value]), cv2.COLOR_HSV2BGR)


def test_bright_sharp_colour_frame_is_good_daytime():
    result = quality.assess(_textured(150))
    assert result.quality == "good"
    assert result.is_night is False


def test_dark_frame_is_poor_and_night():
    result = quality.assess(_textured(20))
    assert result.quality == "poor"
    assert result.is_night is True


def test_dim_frame_is_fair():
    result = quality.assess(_textured(55))
    assert result.quality == "fair"
    assert result.is_night is True


def test_blurred_frame_is_poor():
    blurred = cv2.GaussianBlur(_textured(150), (51, 51), 0)
    assert quality.assess(blurred).quality == "poor"


def test_bright_infrared_frame_counts_as_night():
    result = quality.assess(_textured(150, color=False))
    assert result.quality == "good"
    assert result.is_night is True
