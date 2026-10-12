from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from semarsight_worker.models import CameraResult, CameraRow, VisionResult
from semarsight_worker.sources.openmeteo import GridWeather
from semarsight_worker.water_pipeline import WaterObservation, WaterPipeline

NOW = datetime(2026, 10, 11, 9, 0, tzinfo=timezone.utc)
SETTINGS = SimpleNamespace(
    ai_vision_enabled=True,
    openai_api_key="test",
    openai_vision_model="test-model",
    water_only_featured=True,
    ai_daily_call_cap=100,
)


class FakeDatabase:
    dry_run = False

    def __init__(self, statuses: list[str]) -> None:
        """`statuses`: status pembacaan AI yang sudah tersimpan, dari yang terbaru, berjarak 30 menit."""
        self.rows = [
            {
                "status": status,
                "road_flood": "tidak_relevan",
                "confidence": 0.9,
                "quality": "good",
                "raw": {"output": {"change_vs_reference": "sama" if status == "normal" else "jauh_lebih_tinggi"}},
                "captured_at": (NOW - timedelta(minutes=30 * i)).isoformat(),
            }
            for i, status in enumerate(statuses)
        ]
        self.inserted: list[dict] = []
        self.reads = 0
        self.links: list[dict] = []

    def river_links(self) -> list[dict]:
        return self.links

    def latest_water_call_times(self) -> dict:
        return {}

    def water_calls_since(self, start: datetime) -> int:
        return 7

    def recent_water_readings(self, camera_id: str, limit: int) -> list[dict]:
        self.reads += 1
        return self.rows[:limit]

    def insert_water_reading(self, row: dict) -> None:
        self.inserted.append(row)


def _camera(**overrides) -> CameraRow:
    values = {
        "id": "cam-1",
        "source_link_id": 1,
        "name": "Pompa Uji",
        "modules": ["water"],
        "stream_url": "http://example.invalid/stream.m3u8",
        "is_featured": True,
        "weather_grid_id": "G2",
        "water_kind": "sungai",
        "roi": {"points": [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]]},
    }
    return CameraRow.model_validate(values | overrides)


def _weather(rain_next_3h_mm: float) -> dict[str, GridWeather]:
    return {
        "G2": GridWeather(
            grid_id="G2",
            precip_now_mm=0.0,
            precip_next_1h_mm=0.0,
            precip_next_3h_mm=rain_next_3h_mm,
            precip_next_6h_mm=rain_next_3h_mm,
            precip_prob_max_3h=80,
            hourly=[],
        )
    }


def test_risk_follows_the_rain_forecast_between_ai_readings():
    database = FakeDatabase(["normal", "normal", "normal"])
    weather = _weather(0.0)
    pipeline = WaterPipeline(SETTINGS, database, weather)
    live = CameraResult(camera=_camera(), checked_at=NOW + timedelta(minutes=5), health="live")
    before = {"cam-1": {"water_status": "normal"}}

    calm = pipeline.commit([live], before)["cam-1"]
    assert calm == {"water_trend": "stabil", "risk_score": 0.0, "risk_level": "rendah", "risk_components": calm["risk_components"]}

    weather.update(_weather(10.0))  # job cuaca memperbarui prakiraan di antara dua siklus
    wet = pipeline.commit([live], before)["cam-1"]
    assert wet["risk_score"] == pytest.approx(0.1)
    assert wet["risk_components"]["inputs"]["rain_next_3h_mm"] == 10.0
    assert "water_status" not in wet  # status resmi hanya berubah lewat pembacaan AI
    assert database.reads == 1  # riwayat level cukup dibaca sekali
    assert database.inserted == []


def test_calls_made_earlier_today_are_counted_from_the_start():
    assert WaterPipeline(SETTINGS, FakeDatabase([]), {}).calls_today == 7


def test_no_outlook_for_dead_uncalibrated_or_unconfirmed_cameras():
    pipeline = WaterPipeline(SETTINGS, FakeDatabase(["normal"]), _weather(10.0))
    at = NOW + timedelta(minutes=5)
    results = [
        CameraResult(camera=_camera(id="dead"), checked_at=at, health="dead"),
        CameraResult(camera=_camera(id="uncalibrated", roi=None), checked_at=at, health="live"),
        CameraResult(camera=_camera(id="unconfirmed"), checked_at=at, health="live"),
    ]
    before = {"dead": {"water_status": "normal"}, "uncalibrated": {"water_status": "normal"}, "unconfirmed": {"water_status": None}}
    assert pipeline.commit(results, before) == {}


def test_an_ai_reading_updates_status_trend_and_risk_together():
    database = FakeDatabase(["siaga", "siaga", "normal", "normal"])
    pipeline = WaterPipeline(SETTINGS, database, _weather(20.0))
    vision = VisionResult(
        image_usable=True,
        status="siaga",
        road_flood="tidak_relevan",
        trash="tidak_terlihat",
        water_position="di garis siaga",
        change_vs_reference="jauh_lebih_tinggi",
        confidence=0.9,
        reason="air menyentuh garis siaga",
    )
    observed = CameraResult(camera=_camera(), checked_at=NOW, health="live")
    observed.water = WaterObservation(trigger="change", change=0.3, result=vision, raw={})

    update = pipeline.commit([observed], {"cam-1": {"water_status": "normal"}})["cam-1"]
    assert update["water_status"] == "siaga"
    assert update["water_status_since"] == NOW.isoformat()
    assert update["water_trend"] == "naik_cepat"  # dua level di atas pembacaan 60 menit lalu
    # 0,40 x 0,7 (siaga) + 0,20 x 1,0 (naik cepat) + 0,20 x 1,0 (hujan 20 mm)
    assert update["risk_score"] == pytest.approx(0.68)
    assert update["risk_level"] == "tinggi"
    assert len(database.inserted) == 1
    assert database.inserted[0]["raw"]["smoothing"] == {"level": "siaga", "previous": "normal", "confirmed": "siaga"}


def test_a_first_raised_reading_is_recorded_as_counted_but_not_yet_confirmed():
    database = FakeDatabase(["normal", "normal", "normal"])
    pipeline = WaterPipeline(SETTINGS, database, _weather(0.0))

    def observe(confidence: float) -> dict:
        vision = VisionResult(
            image_usable=True, status="waspada", road_flood="tidak_relevan", trash="tidak_terlihat", water_position="di atas N",
            change_vs_reference="sedikit_lebih_tinggi", confidence=confidence, reason="air sedikit di atas garis normal",
        )  # fmt: skip
        observed = CameraResult(camera=_camera(), checked_at=NOW, health="live")
        observed.water = WaterObservation(trigger="heartbeat", change=0.1, result=vision, raw={"usage": {}})
        update = pipeline.commit([observed], {"cam-1": {"water_status": "normal"}})["cam-1"]
        return update | {"smoothing": database.inserted[-1]["raw"]["smoothing"]}

    sure = observe(0.8)
    assert (sure["water_status"], sure["needs_verification"]) == ("normal", False)
    assert sure["smoothing"] == {"level": "waspada", "previous": "normal", "confirmed": "normal"}
    unsure = observe(0.55)  # busa pompa: dinilai naik dengan keyakinan rendah, jadi tidak dihitung
    assert (unsure["water_status"], unsure["needs_verification"]) == ("normal", True)
    assert unsure["smoothing"] == {"level": None, "previous": "normal", "confirmed": "normal"}
    assert database.inserted[-1]["raw"]["usage"] == {}  # isi raw yang lain tetap ada


def test_upstream_status_raises_the_risk_of_the_downstream_site():
    database = FakeDatabase(["normal", "normal", "normal"])
    database.links = [
        {"upstream_camera_id": "hulu", "downstream_camera_id": "cam-1", "river_system": "Pompa Uji", "default_lag_minutes": 15, "learned_lag_minutes": None}
    ]
    pipeline = WaterPipeline(SETTINGS, database, _weather(0.0))
    at = NOW + timedelta(minutes=5)
    results = [
        CameraResult(camera=_camera(id="hulu", name="Pompa Uji-IN"), checked_at=at, health="live"),
        CameraResult(camera=_camera(), checked_at=at, health="live"),
    ]

    calm = pipeline.commit(results, {"hulu": {"water_status": "normal"}, "cam-1": {"water_status": "normal"}})["cam-1"]
    assert calm["risk_score"] == 0.0
    assert calm["risk_components"]["inputs"]["upstream_name"] == "Pompa Uji-IN"

    updates = pipeline.commit(results, {"hulu": {"water_status": "siaga"}, "cam-1": {"water_status": "normal"}})
    downstream = updates["cam-1"]
    assert downstream["risk_components"]["upstream"] == 0.7
    assert downstream["risk_score"] == pytest.approx(0.14)  # 0,7 x bobot hulu 20%
    assert downstream["risk_components"]["inputs"]["upstream_status"] == "siaga"
    assert "upstream_name" not in updates["hulu"]["risk_components"]["inputs"]  # lokasi hulu sendiri tidak punya hulu
