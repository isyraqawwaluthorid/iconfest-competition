from datetime import datetime, timezone

from semarsight_worker.main import split_unreachable
from semarsight_worker.models import CameraResult, CameraRow

NOW = datetime(2026, 10, 11, 4, 0, tzinfo=timezone.utc)
NOT_FOUND = "Error opening input files: Server returned 404 Not Found"
RESET = "Error opening input files: Error number -10054 occurred"


def _result(index: int, health: str, error: str | None = None) -> CameraResult:
    cam = CameraRow(id=f"cam-{index}", source_link_id=index, name=f"Kamera {index}", stream_url="https://example/x.m3u8")
    return CameraResult(cam, NOW, health, error=error)


def _cycle(live: int, not_found: int, reset: int) -> list[CameraResult]:
    kinds = [("live", None)] * live + [("dead", NOT_FOUND)] * not_found + [("dead", RESET)] * reset
    return [_result(i, health, error) for i, (health, error) in enumerate(kinds)]


def test_normal_cycle_records_every_camera():
    results = _cycle(live=130, not_found=12, reset=4)
    recordable, unreachable = split_unreachable(results)
    assert recordable == results
    assert unreachable == []


def test_mass_connection_failures_are_not_recorded_as_dead_cameras():
    results = _cycle(live=43, not_found=10, reset=93)
    recordable, unreachable = split_unreachable(results)
    assert len(unreachable) == 93
    assert all(r.error == RESET for r in unreachable)
    assert [r.health for r in recordable].count("live") == 43
    assert [r.error for r in recordable].count(NOT_FOUND) == 10


def test_many_cameras_answering_404_is_a_source_problem_and_is_recorded():
    results = _cycle(live=20, not_found=126, reset=0)
    recordable, unreachable = split_unreachable(results)
    assert len(recordable) == 146
    assert unreachable == []


def test_small_test_runs_are_never_treated_as_an_outage():
    results = _cycle(live=0, not_found=0, reset=3)
    recordable, unreachable = split_unreachable(results)
    assert len(recordable) == 3
    assert unreachable == []
