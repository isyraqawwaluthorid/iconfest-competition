from semarsight_worker.fusion import cross_module
from semarsight_worker.models import CameraRow

LAT, LNG = -6.99, 110.42
STEP = 0.001  # ±110 m


def cam(cam_id: str, east_steps: float, modules: list[str]) -> CameraRow:
    return CameraRow(id=cam_id, source_link_id=1, name=cam_id.upper(), modules=modules, stream_url="x", lat=LAT, lng=LNG + STEP * east_steps)


def traffic(index: float, level: str, *, provisional: bool = False, health: str = "live") -> dict:
    return {"health": health, "density_index": index, "density_level": level, "baseline_is_provisional": provisional}


SITE = cam("pompa", 0, ["water"])


def test_counts_live_traffic_cameras_within_the_radius():
    cameras = [SITE, cam("a", 2, ["traffic"]), cam("b", 5, ["traffic"]), cam("jauh", 12, ["traffic"])]
    statuses = {"a": traffic(2.1, "padat"), "b": traffic(0.9, "normal"), "jauh": traffic(3.0, "padat")}
    near = cross_module.nearby_traffic(SITE, cameras, statuses)
    assert (near.cameras, near.busy, near.median_index) == (2, 1, 1.5)
    assert (near.busiest_name, near.busiest_level) == ("A", "padat")
    assert near.as_fact()["baseline"] == "per_jam"


def test_a_site_that_is_also_a_traffic_camera_counts_itself():
    road = cam("jalan", 0, ["water", "traffic"])
    statuses = {"jalan": traffic(1.9, "padat") | {"road_flood": "genangan_ringan"}, "a": traffic(1.0, "normal")}
    near = cross_module.nearby_traffic(road, [road, cam("a", 3, ["traffic"])], statuses)
    assert near.cameras == 2 and near.busiest_id == "jalan"


def test_dead_cameras_and_cameras_without_an_index_are_left_out():
    cameras = [SITE, cam("a", 1, ["traffic"]), cam("mati", 2, ["traffic"]), cam("baru", 3, ["traffic"]), cam("kolam", 1, ["water"])]
    statuses = {"a": traffic(1.0, "normal"), "mati": traffic(2.0, "padat", health="dead"), "baru": {"health": "live", "density_index": None}}
    assert cross_module.nearby_traffic(SITE, cameras, statuses) is None  # tinggal satu titik: terlalu sedikit


def test_provisional_baselines_are_flagged_not_hidden():
    cameras = [SITE, cam("a", 1, ["traffic"]), cam("b", 2, ["traffic"])]
    statuses = {"a": traffic(1.4, "ramai"), "b": traffic(1.6, "ramai", provisional=True)}
    assert cross_module.nearby_traffic(SITE, cameras, statuses).as_fact()["baseline"] == "sementara"


def test_a_site_without_coordinates_has_no_neighbours():
    nowhere = CameraRow(id="x", source_link_id=1, name="X", modules=["water"], stream_url="x")
    cameras = [nowhere, cam("a", 1, ["traffic"]), cam("b", 2, ["traffic"])]
    assert cross_module.nearby_traffic(nowhere, cameras, {"a": traffic(1, "normal"), "b": traffic(1, "normal")}) is None


def test_raised_means_elevated_water_or_a_flooded_road():
    assert cross_module.is_raised({"water_status": "siaga"})
    assert cross_module.is_raised({"water_status": "normal", "road_flood": "genangan_ringan"})
    assert not cross_module.is_raised({"water_status": "normal", "road_flood": "tidak_tergenang"})
    assert not cross_module.is_raised({"water_status": "tidak_dapat_dinilai"})


def test_event_keeps_the_densest_moment():
    busy, calm = {"median_index": 1.8, "cameras": 3}, {"median_index": 1.1, "cameras": 3}
    assert cross_module.worse_impact(None, calm) == calm
    assert cross_module.worse_impact(busy, calm) == busy
    assert cross_module.worse_impact(calm, busy) == busy
