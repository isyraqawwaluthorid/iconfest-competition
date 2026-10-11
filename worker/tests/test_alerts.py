from semarsight_worker import alerts
from semarsight_worker.models import CameraRow
from semarsight_worker.sources.openmeteo import GridWeather


def _camera(camera_id: str = "cam-1", **overrides) -> CameraRow:
    values = {
        "id": camera_id,
        "source_link_id": 1,
        "name": "Pompa Uji",
        "modules": ["water"],
        "stream_url": "http://example.invalid/stream.m3u8",
        "is_featured": True,
        "weather_grid_id": "G2",
        "water_kind": "pompa_in",
        "roi": {"points": [[0.1, 0.1], [0.9, 0.1], [0.5, 0.9]]},
    }
    return CameraRow.model_validate(values | overrides)


def _weather(**rain_by_grid: float) -> dict[str, GridWeather]:
    return {
        grid_id: GridWeather(
            grid_id=grid_id,
            precip_now_mm=0.0,
            precip_next_1h_mm=0.0,
            precip_next_3h_mm=rain,
            precip_next_6h_mm=rain,
            precip_prob_max_3h=None,
            hourly=[],
            grid_name=f"Wilayah {grid_id}",
        )
        for grid_id, rain in rain_by_grid.items()
    }


def test_no_water_alert_while_status_is_normal_or_unknown():
    cameras = [_camera("a"), _camera("b")]
    statuses = {"a": {"water_status": "normal"}, "b": {"water_status": None}}
    assert alerts.water_alerts(cameras, statuses, {}) == []


def test_elevated_water_status_becomes_an_alert_at_the_same_level():
    statuses = {"cam-1": {"water_status": "siaga", "water_trend": "naik_cepat", "risk_level": "tinggi"}}
    [alert] = alerts.water_alerts([_camera()], statuses, _weather(G2=12.0))
    assert (alert.type, alert.level, alert.camera_id) == ("water_rising", "siaga", "cam-1")
    assert alert.title == "Air siaga di Pompa Uji"
    assert alert.message == "Muka air berstatus siaga, naik cepat."
    assert alert.data["rain_next_3h_mm"] == 12.0


def test_road_cameras_raise_a_flooded_road_alert_instead():
    statuses = {"cam-1": {"water_status": "waspada", "road_flood": "genangan_ringan", "water_trend": "stabil"}}
    [alert] = alerts.water_alerts([_camera(water_kind="jalan")], statuses, {})
    assert alert.type == "road_flooded"
    assert alert.message == "Jalan terpantau tergenang (ringan), status waspada, stabil."
    assert "dishub" in alert.audience


def test_heavy_rain_alert_names_the_wettest_areas_first():
    alert = alerts.rain_alert(_weather(G1=3.0, G2=12.4, G5=24.6), already_active=False)
    assert alert.level == "waspada"  # puncak di atas 20 mm
    assert alert.camera_id is None
    assert alert.message == "Prakiraan hujan hingga 25 mm dalam 3 jam ke depan di Wilayah G5, Wilayah G2."
    assert alert.data["grids"] == {"G5": 24.6, "G2": 12.4}


def test_heavy_rain_alert_stays_until_the_forecast_clearly_drops():
    assert alerts.rain_alert(_weather(G2=8.0), already_active=False) is None
    assert alerts.rain_alert(_weather(G2=8.0), already_active=True).level == "info"
    assert alerts.rain_alert(_weather(G2=6.0), already_active=True) is None


def test_trash_alert_needs_both_heavy_trash_and_heavy_rain():
    cameras = [_camera()]
    trashy = {"cam-1": {"trash": "banyak"}}
    assert alerts.trash_alerts(cameras, trashy, _weather(G2=4.0)) == []
    assert alerts.trash_alerts(cameras, {"cam-1": {"trash": "sedikit"}}, _weather(G2=15.0)) == []
    [alert] = alerts.trash_alerts(cameras, trashy, _weather(G2=15.0))
    assert (alert.type, alert.level, alert.audience) == ("trash_blockage", "siaga", ("pu",))


def test_only_featured_cameras_dead_for_half_an_hour_raise_an_offline_alert():
    cameras = [_camera("featured"), _camera("brief"), _camera("ordinary", is_featured=False)]
    statuses = {
        "featured": {"consecutive_failures": 6},
        "brief": {"consecutive_failures": 5},
        "ordinary": {"consecutive_failures": 40},
    }
    [alert] = alerts.offline_alerts(cameras, statuses)
    assert (alert.type, alert.camera_id, alert.level) == ("camera_offline", "featured", "info")


def test_reconcile_inserts_updates_and_resolves_only_what_changed():
    rising = alerts.Alert(type="water_rising", level="siaga", camera_id="a", title="Air siaga di A", message="Muka air berstatus siaga.")
    steady = alerts.Alert(type="water_rising", level="waspada", camera_id="b", title="Air waspada di B", message="Muka air berstatus waspada.")
    rain = alerts.Alert(type="heavy_rain", level="info", title="Prakiraan hujan lebat", message="Prakiraan hujan hingga 12 mm.")
    active = [
        {"id": "1", "type": "water_rising", "camera_id": "a", "level": "waspada", "title": "Air waspada di A", "message": "Muka air berstatus waspada."},
        {"id": "2", "type": "water_rising", "camera_id": "b", "level": "waspada", "title": "Air waspada di B", "message": "Muka air berstatus waspada."},
        {"id": "3", "type": "camera_offline", "camera_id": "c", "level": "info", "title": "Kamera C tidak terbaca", "message": "..."},
    ]
    changes = alerts.reconcile([rising, steady, rain], active)
    assert [(row["type"], row["camera_id"]) for row in changes.insert] == [("heavy_rain", None)]
    assert [(alert_id, fields["level"]) for alert_id, fields in changes.update] == [("1", "siaga")]
    assert changes.resolve == ["3"]


class FakeDatabase:
    def __init__(self, statuses: dict, active: list[dict]) -> None:
        self.statuses, self.active = statuses, active
        self.inserted: list[dict] = []
        self.resolved: list[str] = []

    def alert_inputs(self) -> dict:
        return self.statuses

    def active_alerts(self, types: tuple[str, ...]) -> list[dict]:
        return [row for row in self.active if row["type"] in types]

    def insert_alerts(self, rows: list[dict]) -> None:
        self.inserted += rows

    def update_alert(self, alert_id: str, fields: dict) -> None:
        raise AssertionError("tidak ada yang perlu diperbarui pada uji ini")

    def resolve_alerts(self, alert_ids: list[str], at) -> None:
        self.resolved += alert_ids


def test_sync_ignores_uncalibrated_cameras_and_closes_alerts_that_no_longer_apply():
    cameras = [_camera("calibrated"), _camera("uncalibrated", roi=None), _camera("traffic", modules=["traffic"], is_featured=False)]
    statuses = {
        "calibrated": {"water_status": "waspada", "water_trend": "naik"},
        "uncalibrated": {"water_status": "awas"},
        "traffic": {"consecutive_failures": 12},
    }
    stale = {"id": "9", "type": "heavy_rain", "camera_id": None, "level": "info", "title": "Prakiraan hujan lebat", "message": "..."}
    database = FakeDatabase(statuses, [stale])

    alerts.sync(database, cameras, _weather(G2=1.0))
    assert [(row["type"], row["camera_id"], row["level"]) for row in database.inserted] == [("water_rising", "calibrated", "waspada")]
    assert database.resolved == ["9"]
