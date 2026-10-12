from semarsight_worker import roads
from semarsight_worker.roads import Way

LAT = -6.99
STEP = 0.001  # ±110 m per langkah di sekitar Semarang


def way(way_id: int, name: str, points: list[tuple[float, float]], nodes: list[int], highway: str = "primary") -> Way:
    return Way(id=way_id, name=name, key=name, highway=highway, nodes=tuple(nodes), points=tuple(points))


def east_west(way_id: int, name: str, start: int, count: int, lat: float = LAT, highway: str = "primary") -> Way:
    """Garis lurus ke timur; simpul bernomor `start`.. sehingga garis yang bersambung berbagi simpul ujung."""
    return way(
        way_id,
        name,
        [(lat, 110.40 + STEP * (start + i)) for i in range(count)],
        [start + i for i in range(count)],
        highway,
    )


def test_segment_extends_reach_in_both_directions():
    road = east_west(1, "Jalan Pemuda", 0, 11)
    segment = roads.segment_for((LAT, 110.405), [road])
    assert segment.road_name == "Jalan Pemuda"
    assert len(segment.lines) == 1
    assert abs(segment.length_m - 2 * roads.REACH_M) < 1
    assert not segment.needs_review


def test_segment_continues_into_the_next_way_of_the_same_road():
    first, second = east_west(1, "Jalan Pemuda", 0, 3), east_west(2, "Jalan Pemuda", 2, 6)
    segment = roads.segment_for((LAT, 110.4015), [first, second])
    # Ke timur garis pertama habis setelah ±55 m, lalu bersambung ke garis kedua sampai genap 200 m.
    assert abs(segment.length_m - (165 + roads.REACH_M)) < 3
    assert segment.lines[0][-1][1] > first.points[-1][1]


def test_segment_does_not_continue_into_a_differently_named_road():
    first, other = east_west(1, "Jalan Pemuda", 0, 3), east_west(2, "Jalan Imam Bonjol", 2, 6)
    segment = roads.segment_for((LAT, 110.4015), [first, other])
    assert segment.lines[0][-1] == first.points[-1]


def test_major_road_wins_over_a_nearer_side_street():
    main = east_west(1, "Jalan Siliwangi", 0, 11, highway="trunk")
    alley = east_west(2, "Gang Kecil", 0, 11, lat=LAT + 0.0001, highway="residential")
    segment = roads.segment_for((LAT + 0.00012, 110.405), [main, alley])
    assert segment.road_name == "Jalan Siliwangi"


def test_camera_name_picks_the_named_road_at_a_junction():
    near = east_west(1, "Jalan Pandanaran", 0, 11)
    named = east_west(2, "Jalan Kyai Saleh", 0, 11, lat=LAT + 0.0001, highway="secondary")
    camera = (LAT + 0.00002, 110.405)
    assert roads.segment_for(camera, [near, named]).road_name == "Jalan Pandanaran"
    assert roads.segment_for(camera, [near, named], roads.name_hints("KYAI SALEH")).road_name == "Jalan Kyai Saleh"
    assert roads.name_hints("PEMUDA - GAJAHMADA") == ("pemuda", "gajahmada")
    assert roads.name_hints("SIMPANG LIMA 2") == ()


def test_opposite_carriageway_is_drawn_as_a_second_line():
    north = east_west(1, "Jalan Pahlawan", 0, 11, lat=LAT + 0.0001)
    south = way(2, "Jalan Pahlawan", [(LAT - 0.0001, lng) for _, lng in north.points], list(range(100, 111)))
    segment = roads.segment_for((LAT + 0.0001, 110.405), [north, south])
    assert len(segment.lines) == 2


def test_reach_stops_halfway_to_the_next_camera_on_the_same_road():
    camera = (LAT, 110.405)
    assert roads.shared_reach(camera, []) == roads.REACH_M
    assert abs(roads.shared_reach(camera, [(LAT, 110.407)]) - 110) < 2  # tetangga ±221 m
    assert roads.shared_reach(camera, [(LAT, 110.4055)]) == roads.MIN_REACH_M  # tetangga ±55 m
    assert roads.shared_reach(camera, [(LAT, 110.4051)]) == roads.REACH_M  # tiang yang sama


def test_network_keeps_major_roads_only():
    main = east_west(1, "Jalan Pemuda", 0, 3)
    link = east_west(2, "", 0, 3, highway="primary_link")
    alley = east_west(3, "Gang Kecil", 0, 3, highway="residential")
    assert roads.network_lines([main, link, alley]) == [main.points, link.points]


def test_far_road_is_flagged_and_no_road_gives_none():
    road = east_west(1, "Jalan Pemuda", 0, 11)
    far = roads.segment_for((LAT + 0.0008, 110.405), [road])  # ±89 m dari jalan
    assert far is not None and far.needs_review
    assert roads.segment_for((LAT + 0.002, 110.405), [road]) is None


def test_overpass_elements_without_matching_geometry_are_skipped():
    elements = [
        {"type": "way", "id": 1, "nodes": [1, 2], "geometry": [{"lat": LAT, "lon": 110.4}, {"lat": LAT, "lon": 110.401}],
         "tags": {"highway": "trunk_link", "ref": "20"}},
        {"type": "way", "id": 2, "nodes": [1, 2, 3], "geometry": [{"lat": LAT, "lon": 110.4}], "tags": {"highway": "primary"}},
        {"type": "node", "id": 3},
    ]
    (only,) = roads.ways_from_overpass(elements)
    assert (only.name, only.key, only.road_class, only.is_major) == ("", "20", "trunk", True)
