from datetime import datetime, timedelta, timezone

import pytest

from semarsight_worker.fusion import risk, trend
from semarsight_worker.sources import openmeteo

NOW = datetime(2026, 10, 11, 9, 0, tzinfo=timezone.utc)


def _history(*points: tuple[int, int]) -> list[tuple[datetime, int]]:
    """Riwayat (menit lalu, level), terurut dari yang terbaru."""
    return [(NOW - timedelta(minutes=minutes), level) for minutes, level in sorted(points)]


def test_trend_unknown_without_a_comparison():
    assert trend.water_trend(1, [], NOW) == "tidak_diketahui"
    assert trend.water_trend(None, _history((30, 0)), NOW) == "tidak_diketahui"


def test_trend_stable_when_level_is_unchanged():
    assert trend.water_trend(0, _history((30, 0), (60, 0)), NOW) == "stabil"


def test_one_level_up_within_half_an_hour_is_a_fast_rise():
    assert trend.water_trend(1, _history((30, 0), (60, 0)), NOW) == "naik_cepat"


def test_two_levels_up_within_an_hour_is_a_fast_rise():
    assert trend.water_trend(2, _history((30, 2), (60, 0)), NOW) == "naik_cepat"


def test_one_level_up_over_an_hour_is_a_rise():
    assert trend.water_trend(1, _history((30, 1), (60, 0)), NOW) == "naik"


def test_lower_level_is_a_fall():
    assert trend.water_trend(0, _history((30, 1), (60, 2)), NOW) == "turun"


def test_readings_too_old_to_compare_are_ignored():
    assert trend.water_trend(1, _history((180, 0)), NOW) == "tidak_diketahui"


def test_risk_is_none_until_a_status_is_confirmed():
    assert risk.risk_score(None, "stabil", None, 0.0) is None
    assert risk.risk_score("tidak_dapat_dinilai", "stabil", None, 0.0) is None


def test_calm_normal_location_has_zero_risk():
    result = risk.risk_score("normal", "stabil", None, 0.0)
    assert (result.score, result.level) == (0.0, "rendah")


def test_risk_is_the_weighted_sum_of_its_open_components():
    result = risk.risk_score("siaga", "naik", "waspada", 10.0)
    # 0,40 x 0,7 + 0,20 x 0,5 + 0,20 x 0,4 + 0,20 x 0,5
    assert result.score == pytest.approx(0.56)
    assert result.level == "tinggi"
    assert result.components["status"] == 0.7
    assert result.components["rain"] == 0.5
    assert result.components["weights"] == risk.WEIGHTS


def test_worst_case_reaches_the_top_level_and_rain_is_capped():
    result = risk.risk_score("awas", "naik_cepat", "awas", 80.0)
    assert result.score == 1.0
    assert result.level == "sangat_tinggi"


def test_rain_alone_raises_risk_at_a_normal_location():
    result = risk.risk_score("normal", "stabil", None, 20.0)
    assert result.score == pytest.approx(0.2)
    assert result.level == "rendah"


def _payload(now: datetime, rain: list[float], probability: list[float | None], current: float = 0.0) -> dict:
    start = now.replace(minute=0, second=0, microsecond=0)
    times = [int((start + timedelta(hours=i)).timestamp()) for i in range(len(rain))]
    return {"current": {"precipitation": current}, "hourly": {"time": times, "precipitation": rain, "precipitation_probability": probability}}


def test_weather_summary_sums_only_the_hours_ahead():
    at = NOW + timedelta(minutes=20)  # 09.20: slot 09.00 sudah lewat, slot pertama ke depan adalah 10.00
    summary = openmeteo.summarize("G2", _payload(NOW, [9.0, 1.0, 2.0, 4.0, 0.5, 0.0, 0.0, 3.0], [90, 40, 70, 60, 10, 0, 0, 30], current=0.4), at)
    assert summary.precip_now_mm == 0.4
    assert summary.precip_next_1h_mm == 1.0
    assert summary.precip_next_3h_mm == 7.0
    assert summary.precip_next_6h_mm == 7.5
    assert summary.precip_prob_max_3h == 70
    assert summary.rain_for_trigger_mm == 1.0
    assert summary.hourly[0]["precipitation"] == 1.0


def test_weather_summary_survives_missing_values():
    summary = openmeteo.summarize("G1", {"current": {}, "hourly": {}}, NOW)
    assert (summary.precip_now_mm, summary.precip_next_3h_mm, summary.precip_prob_max_3h) == (0.0, 0.0, None)
    summary = openmeteo.summarize("G1", _payload(NOW, [0.0, None, 1.5], [None, None, None]), NOW)
    assert summary.precip_next_3h_mm == 1.5
    assert summary.precip_prob_max_3h is None
