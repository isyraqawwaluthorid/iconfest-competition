from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

import pytest

from semarsight_worker import insights
from semarsight_worker.models import CameraRow, InsightResult
from semarsight_worker.sources.openmeteo import GridWeather

NOW = datetime(2026, 10, 12, 6, 45, tzinfo=timezone.utc)  # 13.45 WIB


def _camera(camera_id: str, name: str = "Pompa Uji", **overrides) -> CameraRow:
    values = {
        "id": camera_id,
        "source_link_id": 1,
        "name": name,
        "modules": ["water"],
        "stream_url": "http://example.invalid/stream.m3u8",
        "is_featured": True,
        "weather_grid_id": "G2",
        "water_kind": "pompa_in",
    }
    return CameraRow.model_validate(values | overrides)


def _status(**overrides) -> dict:
    return {"health": "live", "water_status": "normal", "water_trend": "stabil", "risk_score": 0.005, "risk_level": "rendah"} | overrides


def _weather(rain_next_3h: float = 0.4) -> dict[str, GridWeather]:
    return {
        "G2": GridWeather(
            grid_id="G2",
            precip_now_mm=0.0,
            precip_next_1h_mm=0.1,
            precip_next_3h_mm=rain_next_3h,
            precip_next_6h_mm=rain_next_3h,
            precip_prob_max_3h=70.0,
            hourly=[],
            grid_name="Semarang Utara / Tengah",
        )
    }


def _facts(statuses: dict | None = None, *, rain: float = 0.4, alerts: list | None = None, cameras: list | None = None) -> dict:
    cameras = cameras or [_camera("a", "Pompa A"), _camera("b", "Pompa B")]
    statuses = statuses or {"a": _status(), "b": _status()}
    return insights.build_facts(cameras, statuses, _weather(rain), alerts or [], NOW)


def _result(**overrides) -> InsightResult:
    item = {
        "title": "Status air normal",
        "body": "Semua 2 lokasi yang dipantau berstatus normal.",
        "cause": "Tren stabil.",
        "impact": "Tidak ada gangguan di lokasi pantau.",
        "module": "air",
        "level": "info",
        "camera_ids": ["a"],
        "evidence": ["Status normal di 2 lokasi."],
        "recommendations": [{"audience": "bpbd", "action": "Lanjutkan pemantauan."}],
    }
    values = {"headline": "Lokasi pantau normal", "summary": "Sebanyak 2 lokasi normal.", "overall_level": "aman", "items": [item]}
    return InsightResult.model_validate(values | overrides)


def test_calm_city_is_level_aman_and_lists_nothing_needing_attention():
    facts = _facts()
    assert facts["overall_level"] == "aman"
    assert facts["water"]["sites_monitored"] == 2
    assert facts["water"]["by_status"] == {"normal": 2}
    assert facts["water"]["attention"] == []
    assert facts["generated_at_wib"] == "12 Okt 2026 13.45"


def test_overall_level_follows_the_worst_confirmed_water_status():
    facts = _facts({"a": _status(water_status="siaga", water_trend="naik_cepat"), "b": _status(water_status="waspada")})
    assert facts["overall_level"] == "siaga"
    assert [site["name"] for site in facts["water"]["attention"]] == ["Pompa A", "Pompa B"]
    assert facts["water"]["rising"] == 1


@pytest.mark.parametrize(("rain", "level"), [(4.0, "aman"), (12.0, "perlu_perhatian"), (22.0, "waspada")])
def test_forecast_rain_alone_raises_the_level_by_rule(rain, level):
    assert _facts(rain=rain)["overall_level"] == level


def test_provisional_traffic_baseline_sends_no_density_levels():
    cameras = [_camera("a"), _camera("t", "Simpang Uji", modules=["traffic"])]
    statuses = {"a": _status(), "t": {"health": "live", "density_index": 15.0, "density_level": "padat", "baseline_is_provisional": True}}
    facts = _facts(statuses, cameras=cameras)
    assert facts["traffic"] == {"sites_with_index": 1, "baseline": "sementara"}
    assert any("pembanding sementara" in note for note in facts["limits"])


def test_comparable_traffic_baseline_reports_levels_and_anomalies():
    cameras = [_camera("a"), _camera("t", "Simpang Uji", modules=["traffic"])]
    statuses = {
        "a": _status(),
        "t": {"health": "live", "density_index": 2.1, "density_level": "padat", "baseline_is_provisional": False, "is_anomaly": True},
    }
    traffic = _facts(statuses, cameras=cameras)["traffic"]
    assert traffic["baseline"] == "per_jam"
    assert traffic["by_level"] == {"padat": 1}
    assert [site["name"] for site in traffic["anomalies"]] == ["Simpang Uji"]


def test_signature_ignores_small_number_changes_but_not_a_status_change():
    calm = insights.signature(_facts(rain=0.4))
    assert insights.signature(_facts({"a": _status(risk_score=0.009), "b": _status()}, rain=0.8)) == calm
    assert insights.signature(_facts(rain=6.0)) != calm
    assert insights.signature(_facts({"a": _status(water_status="waspada"), "b": _status()})) != calm


def test_grounded_numbers_pass_including_rounding_and_decimal_comma():
    known = insights.known_numbers({"score": 0.71, "rain_mm": 18.46, "since": "12 Okt 2026 17.20", "sites": [1, 2]})
    assert insights.ungrounded("Skor 0,71 (71%), hujan 18,5 mm dalam 3 jam, sejak 17.20, di 2 lokasi.", known) == []


def test_invented_numbers_and_unmeasured_units_are_reported():
    known = insights.known_numbers({"sites": 20, "rain_mm": 18.5})
    assert insights.ungrounded("Air naik 30 cm di 20 lokasi.", known) == ["satuan '0 cm'", "angka 30"]
    assert insights.ungrounded("Kendaraan melaju 20 km/jam.", known) == ["satuan '0 km/jam'"]
    assert insights.ungrounded("Ada 7 lokasi terdampak.", known) == ["angka 7"]


def test_camera_ids_are_not_treated_as_quotable_numbers():
    known = insights.known_numbers({"attention": [{"camera_id": "9999-4420", "name": "Pompa A"}]})
    assert insights.ungrounded("Sebanyak 4420 warga terdampak.", known) == ["angka 4420"]


def test_enforce_takes_the_level_from_rules_and_caps_item_levels():
    facts = _facts()
    alarmist = _result(overall_level="awas", items=[_result().items[0].model_copy(update={"level": "siaga"})])
    checked, rejected = insights.enforce(alarmist, facts)
    assert (checked.overall_level, checked.items[0].level, rejected) == ("aman", "info", [])


def test_enforce_drops_items_with_invented_numbers_and_unknown_cameras():
    facts = _facts()
    good = _result().items[0].model_copy(update={"camera_ids": ["a", "tidak-ada"]})
    invented = good.model_copy(update={"title": "Air naik", "body": "Air naik 45 cm."})
    checked, rejected = insights.enforce(_result(items=[invented, good]), facts)
    assert [item.title for item in checked.items] == ["Status air normal"]
    assert checked.items[0].camera_ids == ["a"]
    assert rejected == ["Air naik: satuan '5 cm', angka 45"]


def test_enforce_rejects_everything_when_the_summary_invents_a_number():
    checked, rejected = insights.enforce(_result(summary="Sebanyak 37 lokasi normal."), _facts())
    assert checked is None
    assert rejected == ["ringkasan: angka 37"]


def test_enforce_keeps_at_most_two_items_when_calm():
    item = _result().items[0]
    checked, _ = insights.enforce(_result(items=[item, item, item]), _facts())
    assert len(checked.items) == insights.MAX_ITEMS_CALM


class _FakeDatabase:
    dry_run = False

    def __init__(self, statuses: dict, latest: dict | None = None) -> None:
        self.statuses = statuses
        self.latest = latest
        self.inserted: list[dict] = []

    def insight_inputs(self) -> dict:
        return self.statuses

    def active_alerts(self, types: tuple[str, ...]) -> list[dict]:
        return []

    def latest_insight(self, scope: str) -> dict | None:
        return self.latest

    def insert_insight(self, row: dict) -> None:
        self.inserted.append(row)


def _writer(monkeypatch, database: _FakeDatabase, *, fail: bool = False) -> tuple[insights.InsightWriter, list[dict]]:
    calls: list[dict] = []

    def fake_generate(facts, *, api_key, model):
        calls.append(facts)
        if fail:
            return None, {"error": "timeout"}
        return _result(overall_level=facts["overall_level"]), {"model": model, "rejected": []}

    monkeypatch.setattr(insights, "generate", fake_generate)
    settings = SimpleNamespace(openai_api_key="kunci", openai_text_model="model-uji", insight_interval_minutes=15)
    return insights.InsightWriter(settings, database), calls


CAMERAS = [_camera("a", "Pompa A"), _camera("b", "Pompa B")]


def test_writer_writes_once_then_waits_while_nothing_changes(monkeypatch):
    database = _FakeDatabase({"a": _status(), "b": _status()})
    writer, calls = _writer(monkeypatch, database)
    assert writer.update(CAMERAS, _weather(), NOW) is True
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=20)) is False
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=40)) is False
    assert len(calls) == 1
    row = database.inserted[0]
    assert (row["scope"], row["model"], row["headline"]) == ("situasi", "model-uji", "Lokasi pantau normal")
    assert row["facts"]["overall_level"] == row["body"]["overall_level"] == "aman"


def test_writer_refreshes_after_max_age_even_without_change(monkeypatch):
    database = _FakeDatabase({"a": _status(), "b": _status()})
    writer, calls = _writer(monkeypatch, database)
    writer.update(CAMERAS, _weather(), NOW)
    assert writer.update(CAMERAS, _weather(), NOW + insights.MAX_AGE) is True
    assert len(calls) == 2


def test_writer_does_not_wait_for_the_interval_when_the_level_rises(monkeypatch):
    database = _FakeDatabase({"a": _status(), "b": _status()})
    writer, _ = _writer(monkeypatch, database)
    writer.update(CAMERAS, _weather(), NOW)
    database.statuses = {"a": _status(water_status="siaga", water_trend="naik_cepat"), "b": _status()}
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=5)) is True
    assert database.inserted[-1]["facts"]["overall_level"] == "siaga"


def test_writer_waits_for_the_interval_before_explaining_a_lesser_change(monkeypatch):
    database = _FakeDatabase({"a": _status(water_status="waspada"), "b": _status()})
    writer, calls = _writer(monkeypatch, database)
    writer.update(CAMERAS, _weather(), NOW)
    database.statuses = {"a": _status(), "b": _status()}
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=5)) is False
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=15)) is True
    assert len(calls) == 2


def test_writer_keeps_the_previous_insight_when_generation_fails(monkeypatch):
    database = _FakeDatabase({"a": _status(), "b": _status()})
    writer, calls = _writer(monkeypatch, database, fail=True)
    assert writer.update(CAMERAS, _weather(), NOW) is False
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=5)) is False  # tidak mengulang tiap siklus
    assert writer.update(CAMERAS, _weather(), NOW + timedelta(minutes=15)) is False
    assert (len(calls), database.inserted) == (2, [])


def test_writer_restores_the_last_insight_after_a_restart(monkeypatch):
    statuses = {"a": _status(), "b": _status()}
    latest = {"created_at": (NOW - timedelta(minutes=10)).isoformat(), "facts": _facts(statuses)}
    writer, calls = _writer(monkeypatch, _FakeDatabase(statuses, latest))
    assert writer.update(CAMERAS, _weather(), NOW) is False
    assert calls == []


def test_writer_is_disabled_without_a_key_or_in_dry_run(monkeypatch):
    database = _FakeDatabase({"a": _status()})
    database.dry_run = True
    writer, calls = _writer(monkeypatch, database)
    assert writer.enabled is False
    assert writer.update(CAMERAS, _weather(), NOW) is False
    assert calls == []
