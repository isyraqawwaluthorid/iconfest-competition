from datetime import datetime, timedelta, timezone

from semarsight_worker.fusion import events
from semarsight_worker.fusion.upstream import Link
from semarsight_worker.main import record_events
from semarsight_worker.models import CameraResult, CameraRow

NOW = datetime(2026, 10, 12, 10, 0, tzinfo=timezone.utc)


def _open(**overrides) -> dict:
    return {"id": "ev-1", "camera_id": "cam", "started_at": (NOW - timedelta(minutes=40)).isoformat(), "peak_status": "waspada", "snapshot_paths": ["a.jpg"]} | overrides


def test_nothing_happens_while_a_site_stays_normal():
    assert events.step("cam", "pompa_in", "normal", "normal", None, NOW, "b.jpg") is None


def test_a_confirmed_rise_opens_an_event_of_the_right_kind():
    change = events.step("cam", "pompa_in", "normal", "waspada", None, NOW, "b.jpg")
    assert change.opened is True
    assert change.insert == {
        "camera_id": "cam", "kind": "luapan_sungai", "started_at": NOW.isoformat(), "peak_at": NOW.isoformat(),
        "peak_status": "waspada", "snapshot_paths": ["b.jpg"],
    }  # fmt: skip
    assert events.step("cam", "jalan", None, "siaga", None, NOW, None).insert["kind"] == "genangan_jalan"


def test_an_open_event_tracks_its_peak_and_keeps_evidence():
    change = events.step("cam", "pompa_in", "waspada", "siaga", _open(), NOW, "b.jpg")
    assert change.update == ("ev-1", {"peak_status": "siaga", "peak_at": NOW.isoformat(), "snapshot_paths": ["a.jpg", "b.jpg"]})
    easing = events.step("cam", "pompa_in", "siaga", "waspada", _open(peak_status="siaga"), NOW, "a.jpg")
    assert easing is None  # puncak tidak turun, dan gambar yang sama tidak dicatat dua kali


def test_returning_to_normal_closes_the_event_with_its_duration():
    change = events.step("cam", "pompa_in", "waspada", "normal", _open(), NOW, None)
    assert change.update == ("ev-1", {"ended_at": NOW.isoformat(), "duration_minutes": 40})
    assert change.opened is False


def test_lag_is_the_median_gap_between_upstream_and_downstream_rises():
    up = [NOW, NOW + timedelta(days=1), NOW + timedelta(days=2)]
    down = [NOW + timedelta(minutes=20), NOW + timedelta(days=1, minutes=40), NOW + timedelta(days=2, minutes=30)]
    assert events.learned_lag(up, down) == (30, 3)


def test_lag_ignores_downstream_events_without_a_recent_upstream_rise():
    up = [NOW]
    down = [NOW - timedelta(minutes=10), NOW + timedelta(hours=7), NOW + timedelta(minutes=25)]
    assert events.learned_lag(up, down) == (25, 1)
    assert events.learned_lag([], down) is None


class FakeDatabase:
    def __init__(self, open_events: dict | None = None) -> None:
        self.opened = open_events or {}
        self.inserted: list[dict] = []
        self.updated: list[tuple] = []
        self.lags: list[tuple] = []
        self.reads = 0
        self.statuses: dict = {}  # keadaan kamera lalu lintas, untuk dampak di sekitar kejadian

    def open_events(self) -> dict:
        self.reads += 1
        return self.opened

    def insight_inputs(self) -> dict:
        return self.statuses

    def insert_event(self, row: dict) -> None:
        self.inserted.append(row)

    def update_event(self, event_id: str, fields: dict) -> None:
        self.updated.append((event_id, fields))

    def event_starts(self, camera_ids: list[str]) -> dict:
        return {"in": [NOW - timedelta(minutes=20)], "out": [NOW]}

    def update_river_link_lag(self, upstream_id: str, downstream_id: str, lag_minutes: int, from_events: int) -> None:
        self.lags.append((upstream_id, downstream_id, lag_minutes, from_events))


def _result(camera_id: str, kind: str = "pompa_out") -> CameraResult:
    camera = CameraRow.model_validate(
        {"id": camera_id, "source_link_id": 1, "name": f"Lokasi {camera_id}", "modules": ["water"], "stream_url": "http://example.invalid/x.m3u8", "water_kind": kind}
    )
    return CameraResult(camera=camera, checked_at=NOW, health="live", evidence_path=f"readings/{camera_id}/x.jpg")


LINK = Link(upstream_id="in", downstream_id="out", river_system="Pompa Uji", lag_minutes=15, lag_is_learned=False)


def test_a_calm_cycle_does_not_even_read_the_events_table():
    database = FakeDatabase()
    record_events(database, [_result("out")], {"out": {"water_status": "normal"}}, {"out": {"water_status": "normal"}}, [LINK], [])
    assert (database.reads, database.inserted, database.updated) == (0, [], [])


def test_a_downstream_rise_opens_an_event_and_learns_the_lag():
    database = FakeDatabase()
    record_events(database, [_result("out")], {"out": {"water_status": "normal"}}, {"out": {"water_status": "waspada"}}, [LINK], [])
    assert [(row["camera_id"], row["peak_status"]) for row in database.inserted] == [("out", "waspada")]
    assert database.lags == [("in", "out", 20, 1)]


def test_sites_without_an_ai_reading_this_cycle_are_left_alone():
    database = FakeDatabase({"out": _open(camera_id="out")})
    record_events(database, [_result("out")], {"out": {"water_status": "waspada"}}, {"out": {"risk_score": 0.4}}, [LINK], [])
    assert (database.reads, database.updated) == (0, [])


def _traffic_camera(camera_id: str, lng: float) -> CameraRow:
    return CameraRow.model_validate(
        {"id": camera_id, "source_link_id": 2, "name": f"Simpang {camera_id}", "modules": ["traffic"], "stream_url": "http://example.invalid/x.m3u8", "lat": -6.99, "lng": lng}
    )


def _site_with_neighbours() -> tuple[CameraResult, list[CameraRow], dict]:
    result = _result("out")
    result.camera.lat, result.camera.lng = -6.99, 110.42
    cameras = [result.camera, _traffic_camera("t1", 110.421), _traffic_camera("t2", 110.423)]
    statuses = {
        "t1": {"health": "live", "density_index": 2.0, "density_level": "padat", "baseline_is_provisional": False},
        "t2": {"health": "live", "density_index": 1.0, "density_level": "normal", "baseline_is_provisional": False},
    }
    return result, cameras, statuses


def test_a_new_event_records_the_traffic_around_it():
    result, cameras, statuses = _site_with_neighbours()
    database = FakeDatabase()
    database.statuses = statuses
    record_events(database, [result], {"out": {"water_status": "normal"}}, {"out": {"water_status": "waspada"}}, [], cameras)
    impact = database.inserted[0]["traffic_impact"]
    assert (impact["cameras"], impact["busier_than_usual"], impact["median_index"]) == (2, 1, 1.5)
    assert impact["busiest"]["name"] == "Simpang t1"


def test_an_open_event_keeps_its_densest_traffic_moment():
    result, cameras, statuses = _site_with_neighbours()
    calmer = {"median_index": 1.1, "cameras": 2}
    database = FakeDatabase({"out": _open(camera_id="out") | {"traffic_impact": calmer}})
    database.statuses = statuses
    record_events(database, [result], {"out": {"water_status": "waspada"}}, {"out": {"water_status": "waspada"}}, [], cameras)
    assert [fields["traffic_impact"]["median_index"] for _, fields in database.updated if "traffic_impact" in fields] == [1.5]

    busier = {"median_index": 2.4, "cameras": 2}
    database = FakeDatabase({"out": _open(camera_id="out") | {"traffic_impact": busier}})
    database.statuses = statuses
    record_events(database, [result], {"out": {"water_status": "waspada"}}, {"out": {"water_status": "waspada"}}, [], cameras)
    assert not any("traffic_impact" in fields for _, fields in database.updated)
