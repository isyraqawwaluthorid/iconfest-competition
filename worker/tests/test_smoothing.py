from semarsight_worker.fusion.smoothing import Reading, confirm_water_status


def _r(status: str, confidence: float = 0.8, quality: str = "good", road_flood: str = "tidak_relevan") -> Reading:
    return Reading(status=status, road_flood=road_flood, confidence=confidence, quality=quality)


def _confirm(current, *statuses, water_kind="sungai"):
    return confirm_water_status(current, [_r(s) for s in statuses], water_kind)


def test_no_readings_changes_nothing():
    assert confirm_water_status("normal", [], "sungai") == ("normal", False)


def test_one_higher_reading_is_not_enough_to_rise():
    assert _confirm("normal", "siaga", "normal") == ("normal", False)


def test_two_higher_readings_rise_to_the_lower_of_the_two():
    assert _confirm("normal", "awas", "waspada") == ("waspada", False)
    assert _confirm("normal", "siaga", "siaga") == ("siaga", False)


def test_falling_needs_three_lower_readings_and_takes_the_highest():
    assert _confirm("awas", "normal", "normal") == ("awas", False)
    assert _confirm("awas", "normal", "waspada", "normal") == ("waspada", False)


def test_mixed_readings_keep_the_current_status():
    assert _confirm("siaga", "normal", "siaga", "normal") == ("siaga", False)


def test_low_confidence_reading_is_ignored_and_flags_verification():
    readings = [_r("awas", confidence=0.3), _r("awas", confidence=0.4), _r("normal")]
    assert confirm_water_status("normal", readings, "sungai") == ("normal", True)


def test_poor_image_and_unassessable_readings_are_ignored():
    readings = [_r("tidak_dapat_dinilai"), _r("awas", quality="poor"), _r("normal"), _r("normal")]
    assert confirm_water_status("normal", readings, "sungai") == ("normal", True)


def test_valid_readings_are_found_past_ignored_ones():
    readings = [_r("siaga"), _r("tidak_dapat_dinilai"), _r("siaga")]
    assert confirm_water_status("normal", readings, "sungai") == ("siaga", False)


def test_first_status_from_a_single_normal_reading():
    assert _confirm(None, "normal") == ("normal", False)


def test_first_status_above_normal_needs_two_readings():
    assert _confirm(None, "siaga") == (None, False)
    assert _confirm(None, "siaga", "waspada") == ("waspada", False)


def test_raised_status_that_matches_the_normal_reference_is_not_trusted():
    contradictory = Reading("waspada", "tidak_relevan", 0.8, "good", change_vs_reference="sama")
    assert confirm_water_status("normal", [contradictory, contradictory], "sungai") == ("normal", True)
    consistent = Reading("waspada", "tidak_relevan", 0.8, "good", change_vs_reference="sedikit_lebih_tinggi")
    assert confirm_water_status("normal", [consistent, consistent], "sungai") == ("waspada", False)


def test_road_cameras_use_the_road_flood_scale():
    readings = [_r("normal", road_flood="genangan_sedang"), _r("normal", road_flood="genangan_tinggi")]
    assert confirm_water_status("normal", readings, "jalan") == ("siaga", False)


def test_flooded_road_that_looks_like_the_normal_reference_is_not_trusted():
    shiny = Reading("normal", "genangan_ringan", 0.8, "good", change_vs_reference="sama")
    assert confirm_water_status("normal", [shiny, shiny], "jalan") == ("normal", True)
    flooded = Reading("normal", "genangan_ringan", 0.8, "good", change_vs_reference="sedikit_lebih_tinggi")
    assert confirm_water_status("normal", [flooded, flooded], "jalan") == ("waspada", False)
