from semarsight_worker.fusion.upstream import Link, links_from_rows, worst_upstream


def _row(up: str, down: str, **overrides) -> dict:
    values = {"upstream_camera_id": up, "downstream_camera_id": down, "river_system": "Pompa Uji", "default_lag_minutes": 15, "learned_lag_minutes": None}
    return values | overrides


def test_links_use_the_learned_lag_once_there_is_one():
    default, learned = links_from_rows([_row("a", "b"), _row("c", "d", learned_lag_minutes=40)])
    assert default == Link("a", "b", "Pompa Uji", 15, False)
    assert learned == Link("c", "d", "Pompa Uji", 40, True)


def test_worst_upstream_picks_the_highest_status_among_upstream_sites():
    links = links_from_rows([_row("a", "x"), _row("b", "x"), _row("c", "y")])
    statuses = {"a": "waspada", "b": "siaga", "c": "awas"}
    link, status = worst_upstream("x", links, statuses)
    assert (link.upstream_id, status) == ("b", "siaga")


def test_sites_without_a_known_upstream_status_have_none():
    links = links_from_rows([_row("a", "x")])
    assert worst_upstream("x", links, {"a": None}) is None
    assert worst_upstream("x", links, {"a": "tidak_dapat_dinilai"}) is None
    assert worst_upstream("a", links, {"a": "siaga"}) is None
