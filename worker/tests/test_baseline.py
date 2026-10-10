from datetime import datetime, timedelta, timezone

import pytest

from semarsight_worker.fusion import baseline
from semarsight_worker.fusion.baseline import Baseline, RollingHistory

NOW = datetime(2026, 10, 11, 5, 0, tzinfo=timezone.utc)


def _history(values: list[float], *, end: datetime = NOW) -> RollingHistory:
    """Riwayat dengan satu pembacaan per 5 menit, berakhir tepat sebelum `end`."""
    history = RollingHistory()
    for i, value in enumerate(values):
        history.add("cam", end - timedelta(minutes=5 * (len(values) - i)), value)
    return history


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


def test_no_baseline_until_enough_samples():
    assert _history([5] * (baseline.MIN_SAMPLES - 1)).baseline("cam", NOW) is None
    assert _history([5] * baseline.MIN_SAMPLES).baseline("cam", NOW) is not None


def test_rolling_baseline_is_median_and_p90_marked_provisional():
    result = _history(list(range(1, 21))).baseline("cam", NOW)
    assert result == Baseline(median=10.5, p90=pytest.approx(18.1), n=20, provisional=True)


def test_readings_older_than_the_window_are_dropped():
    history = _history([100] * 20, end=NOW - timedelta(hours=25))
    for i in range(12):
        history.add("cam", NOW - timedelta(minutes=5 * (12 - i)), 4)
    assert history.baseline("cam", NOW).median == 4


def test_cameras_do_not_share_history():
    assert _history([5] * 20).baseline("other", NOW) is None


def test_provisional_baseline_never_flags_an_anomaly():
    history = RollingHistory()
    provisional = Baseline(median=10, p90=14, n=50, provisional=True)
    assert [history.is_anomaly("cam", 40, provisional) for _ in range(3)] == [False, False, False]


def test_anomaly_needs_two_consecutive_exceedances():
    history = RollingHistory()
    hourly = Baseline(median=10, p90=14, n=50, provisional=False)
    assert history.is_anomaly("cam", 20, hourly) is False
    assert history.is_anomaly("cam", 20, hourly) is True
    assert history.is_anomaly("cam", 9, hourly) is False
    assert history.is_anomaly("cam", 20, hourly) is False


def test_exceeding_p90_alone_is_not_enough():
    quiet_camera = Baseline(median=10, p90=11, n=50, provisional=False)
    assert baseline.exceeds_baseline(12, quiet_camera) is False
    assert baseline.exceeds_baseline(15, quiet_camera) is True
