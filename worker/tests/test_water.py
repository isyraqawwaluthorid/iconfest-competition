from datetime import datetime, timedelta, timezone

import numpy as np
import pytest

from semarsight_worker.analyzers import water
from semarsight_worker.models import CameraRow, VisionResult

NOW = datetime(2026, 10, 11, 8, 0, tzinfo=timezone.utc)
RULES = dict(change_threshold=0.2, heartbeat_minutes=30, rain_heartbeat_minutes=10, rain_trigger_mm=2.0)


def _camera(**overrides) -> CameraRow:
    base = dict(
        id="cam-1", source_link_id=1, name="Kamera Uji", stream_url="https://example/x.m3u8", modules=["water"],
        roi={"points": [[0.3, 0.5], [0.7, 0.5], [0.7, 0.9], [0.3, 0.9]]},
        reference_lines=[
            {"level": "normal", "points": [[0.1, 0.8], [0.25, 0.8]]},
            {"level": "awas", "points": [[0.1, 0.4], [0.25, 0.4]]},
        ],
    )  # fmt: skip
    return CameraRow(**(base | overrides))


def _frame(seed: int = 1, size=(360, 640)) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, 256, size=(*size, 3), dtype=np.uint8)


def test_region_covers_the_water_area_and_the_reference_lines():
    points = water.region_points(_camera())
    assert points[:, 0].min() == pytest.approx(0.1)  # garis acuan di kiri area air ikut tercakup
    assert points[:, 1].min() == pytest.approx(0.4)
    assert points[:, 0].max() == pytest.approx(0.7)


def test_change_score_is_zero_for_the_same_frame_and_high_for_a_different_one():
    cam = _camera()
    first = water.region_view(_frame(1), cam)
    assert water.change_score(first, None) is None
    assert water.change_score(water.region_view(_frame(1), cam), first) == pytest.approx(0.0, abs=1e-6)
    assert water.change_score(water.region_view(_frame(2), cam), first) > 0.5


def test_change_outside_the_region_is_ignored():
    cam = _camera()
    base = _frame(1)
    altered = base.copy()
    altered[:100, 500:] = 255  # pojok kanan atas, di luar area pengamatan
    assert water.change_score(water.region_view(altered, cam), water.region_view(base, cam)) == pytest.approx(0.0, abs=1e-6)


def test_resolution_change_counts_as_full_change():
    cam = _camera()
    assert water.change_score(water.region_view(_frame(1, (480, 640)), cam), water.region_view(_frame(1), cam)) == 1.0


def test_change_threshold_adapts_to_each_cameras_normal_variation():
    assert water.change_threshold_for(0.12, [0.3] * 5) == float("inf")  # belum cukup sampel
    assert water.change_threshold_for(0.12, [0.03, 0.04, 0.05, 0.04, 0.04, 0.03]) == 0.12  # kamera tenang: ambang dasar
    assert water.change_threshold_for(0.12, [0.28, 0.30, 0.31, 0.29, 0.30, 0.33]) == pytest.approx(0.60)  # kamera beriak


def test_first_call_is_a_heartbeat():
    assert water.should_call_ai(now=NOW, last_call_at=None, change=None, rain_mm=None, **RULES) == "heartbeat"


def test_quiet_camera_waits_for_the_heartbeat():
    recent = NOW - timedelta(minutes=10)
    assert water.should_call_ai(now=NOW, last_call_at=recent, change=0.05, rain_mm=0.0, **RULES) is None
    old = NOW - timedelta(minutes=31)
    assert water.should_call_ai(now=NOW, last_call_at=old, change=0.05, rain_mm=0.0, **RULES) == "heartbeat"


def test_visual_change_triggers_immediately():
    recent = NOW - timedelta(minutes=5)
    assert water.should_call_ai(now=NOW, last_call_at=recent, change=0.35, rain_mm=0.0, **RULES) == "change"


def test_rain_shortens_the_interval():
    assert water.should_call_ai(now=NOW, last_call_at=NOW - timedelta(minutes=12), change=0.05, rain_mm=5.0, **RULES) == "rain"
    assert water.should_call_ai(now=NOW, last_call_at=NOW - timedelta(minutes=6), change=0.05, rain_mm=5.0, **RULES) is None


def test_annotated_crop_is_small_and_marks_the_lines():
    cam = _camera()
    plain = np.full((720, 1280, 3), 128, dtype=np.uint8)
    crop = water.annotated_crop(plain, cam)
    assert crop.shape[1] <= water.VISION_MAX_WIDTH
    assert (crop != 128).any()  # garis dan label tergambar
    assert (plain == 128).all()  # frame asli tidak diubah


def test_failed_result_is_a_safe_fallback():
    result = VisionResult.failed("timeout")
    assert result.status == "tidak_dapat_dinilai"
    assert result.confidence == 0
    assert "timeout" in result.reason


def test_unknown_fields_or_values_are_rejected():
    good = VisionResult.failed("x").model_dump()
    with pytest.raises(ValueError):
        VisionResult.model_validate(good | {"status": "banjir"})
    with pytest.raises(ValueError):
        VisionResult.model_validate(good | {"extra": 1})
    with pytest.raises(ValueError):
        VisionResult.model_validate(good | {"confidence": 1.4})


def _vision(status: str = "normal", confidence: float = 0.8, road_flood: str = "tidak_relevan") -> VisionResult:
    return VisionResult(
        image_usable=True, status=status, road_flood=road_flood, trash="tidak_terlihat", water_position="-",
        change_vs_reference="sama" if status == "normal" else "jauh_lebih_tinggi", confidence=confidence, reason=f"dinilai {status}",
    )  # fmt: skip


def _twice(monkeypatch, answers: list[VisionResult], **camera) -> tuple[VisionResult, dict, int]:
    """Jalankan penilaian dengan jawaban AI yang sudah ditentukan; kembalikan hasil, raw, dan jumlah panggilan."""
    calls = iter(answers)
    count = []

    def fake(*args, **kwargs):
        count.append(1)
        answer = next(calls)
        return answer, {"output": answer.model_dump()}

    monkeypatch.setattr(water, "classify_with_ai", fake)
    result, raw = water.classify_twice_if_raised(_frame(), None, _camera(**camera), None, NOW, api_key="k", model="m")
    return result, raw, len(count)


def test_a_normal_reading_is_not_assessed_twice(monkeypatch):
    result, raw, calls = _twice(monkeypatch, [_vision("normal")])
    assert (result.status, calls, "recheck" in raw) == ("normal", 1, False)


def test_a_raised_reading_counts_only_when_the_same_image_is_judged_raised_again(monkeypatch):
    result, raw, calls = _twice(monkeypatch, [_vision("awas", 0.8), _vision("siaga", 0.7)])
    assert (result.status, result.confidence, calls) == ("siaga", 0.7, 2)  # level terendah, keyakinan terkecil
    assert raw["recheck"]["output"]["status"] == "siaga"


def test_disagreeing_readings_of_the_same_image_are_not_trusted(monkeypatch):
    result, _, calls = _twice(monkeypatch, [_vision("awas", 0.8), _vision("normal", 0.85)])
    assert (result.status, calls) == ("normal", 2)
    assert result.confidence == water.INCONSISTENT_CONFIDENCE  # di bawah ambang: tidak dihitung, ditandai perlu diperiksa
    assert result.reason.startswith("Dua penilaian atas gambar yang sama tidak sepakat (awas, lalu normal).")


def test_road_cameras_are_rechecked_on_a_flooded_road(monkeypatch):
    flooded = _vision("waspada", 0.8, road_flood="genangan_ringan")
    dry = _vision("normal", 0.9, road_flood="tidak_tergenang")
    result, _, calls = _twice(monkeypatch, [flooded, dry], water_kind="jalan")
    assert (result.road_flood, calls, result.confidence) == ("tidak_tergenang", 2, water.INCONSISTENT_CONFIDENCE)
