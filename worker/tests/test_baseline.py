from datetime import datetime, timedelta, timezone

import pytest

from semarsight_worker.fusion import baseline
from semarsight_worker.fusion.baseline import Baseline, History

NOW = datetime(2026, 10, 14, 7, 0, tzinfo=timezone.utc)  # Rabu 14.00 WIB


def _day(history: History, days_ago: int, values: list[float], *, at: datetime = NOW, camera: str = "cam") -> None:
    """Satu pembacaan per 5 menit pada `days_ago` hari sebelumnya, berpusat di jam yang sama dengan `at`."""
    start = at - timedelta(days=days_ago, minutes=5 * (len(values) // 2))
    for i, value in enumerate(values):
        history.add(camera, start + timedelta(minutes=5 * i), value)


def test_density_index_is_value_over_median():
    assert baseline.density_index(15, 10) == 1.5


def test_density_index_floors_tiny_medians_to_one():
    assert baseline.density_index(3, 0) == 3
    assert baseline.density_index(3, 0.4) == 3


@pytest.mark.parametrize(
    ("index", "level"),
    [(0.0, "lancar"), (0.79, "lancar"), (0.8, "normal"), (1.29, "normal"), (1.3, "ramai"),
     (1.79, "ramai"), (1.8, "padat"), (4.0, "padat"), (None, "tidak_diketahui")],
)  # fmt: skip
def test_density_level_boundaries(index, level):
    assert baseline.density_level(index) == level


@pytest.mark.parametrize(
    ("index", "value", "level"),
    [(4.0, 4, "normal"), (1.5, 7, "normal"), (4.0, 8, "padat"), (1.5, 8, "ramai"), (0.5, 2, "lancar"), (1.0, 3, "normal")],
)
def test_few_vehicles_are_never_called_busy_however_many_times_the_usual(index, value, level):
    assert baseline.density_level(index, value) == level


def test_few_vehicles_are_not_an_anomaly():
    empty_at_night = Baseline(median=1, p90=2, n=40, provisional=False)
    assert baseline.exceeds_baseline(baseline.MIN_BUSY_COUNT - 1, empty_at_night) is False
    assert baseline.exceeds_baseline(baseline.MIN_BUSY_COUNT, empty_at_night) is True


def test_no_baseline_until_enough_samples_from_earlier_days():
    history = History()
    _day(history, 1, [5] * (baseline.MIN_SAMPLES - 1))
    assert history.baseline("cam", NOW) is None
    history = History()
    _day(history, 1, [5] * baseline.MIN_SAMPLES)
    assert history.baseline("cam", NOW) is not None


def test_baseline_compares_with_the_same_hour_not_the_whole_day():
    history = History()
    for minutes_back in range(30 * 60, 6 * 60, -5):  # semalam sepi (2 kendaraan), kemarin siang ramai (20)
        busy = 22 * 60 <= minutes_back <= 26 * 60
        history.add("cam", NOW - timedelta(minutes=minutes_back), 20 if busy else 2)
    assert history.baseline("cam", NOW).median == 20


def test_todays_readings_are_not_part_of_the_baseline():
    history = History()
    _day(history, 1, [10] * 20)
    for minutes in range(60, 0, -5):  # satu jam terakhir hari ini jauh lebih padat
        history.add("cam", NOW - timedelta(minutes=minutes), 40)
    result = history.baseline("cam", NOW)
    assert (result.median, result.n) == (10, 20)


def test_baseline_is_median_and_p90_and_provisional_until_three_days():
    history = History()
    _day(history, 2, list(range(1, 11)))
    _day(history, 1, list(range(11, 21)))
    assert history.baseline("cam", NOW) == Baseline(median=10.5, p90=pytest.approx(18.1), n=20, provisional=True, days=2)
    three_days = History()
    for days_ago in (6, 2, 1):  # Kamis, Senin, Selasa: tiga hari kerja
        _day(three_days, days_ago, [10] * 12)
    assert three_days.baseline("cam", NOW) == Baseline(median=10, p90=10, n=36, provisional=False, days=3)


def test_weekdays_are_compared_with_weekdays_when_there_is_enough_data():
    history = History()
    _day(history, 3, [30] * 12)  # Minggu: ramai
    _day(history, 2, [10] * 12)  # Senin
    _day(history, 1, [10] * 12)  # Selasa
    result = history.baseline("cam", NOW)
    assert (result.median, result.days) == (10, 2)


def test_other_kind_of_day_is_used_only_as_a_provisional_fallback():
    history = History()
    for days_ago in (5, 4, 3):  # Jumat hanya 4 pembacaan; Sabtu dan Minggu lengkap
        _day(history, days_ago, [8] * (4 if days_ago == 5 else 12))
    result = history.baseline("cam", NOW)
    assert (result.n, result.provisional) == (28, True)


def test_readings_older_than_the_history_are_dropped():
    history = History()
    _day(history, 15, [100] * 12)
    _day(history, 1, [4] * 12)
    assert history.baseline("cam", NOW).median == 4


def test_cameras_do_not_share_history():
    history = History()
    _day(history, 1, [5] * 20)
    assert history.baseline("other", NOW) is None


def test_provisional_baseline_never_flags_an_anomaly():
    history = History()
    provisional = Baseline(median=10, p90=14, n=50, provisional=True)
    assert [history.is_anomaly("cam", 40, provisional) for _ in range(3)] == [False, False, False]


def test_anomaly_needs_two_consecutive_exceedances():
    history = History()
    hourly = Baseline(median=10, p90=14, n=50, provisional=False)
    assert history.is_anomaly("cam", 20, hourly) is False
    assert history.is_anomaly("cam", 20, hourly) is True
    assert history.is_anomaly("cam", 9, hourly) is False
    assert history.is_anomaly("cam", 20, hourly) is False


def test_exceeding_p90_alone_is_not_enough():
    quiet_camera = Baseline(median=10, p90=11, n=50, provisional=False)
    assert baseline.exceeds_baseline(12, quiet_camera) is False
    assert baseline.exceeds_baseline(15, quiet_camera) is True
