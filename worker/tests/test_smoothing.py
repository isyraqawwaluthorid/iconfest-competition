from semarsight_worker.fusion import smoothing
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


def test_raised_readings_need_more_confidence_than_normal_ones():
    # Busa pompa: "awas" dengan keyakinan 0,55 dua kali berturut-turut tidak boleh menjadi peringatan.
    foam = [_r("awas", confidence=0.55), _r("awas", confidence=0.62), _r("normal"), _r("normal")]
    assert confirm_water_status("normal", foam, "pompa_out") == ("normal", True)
    assert confirm_water_status("normal", [_r("normal", confidence=0.55), _r("normal")], "pompa_out") == ("normal", False)
    sure = [_r("siaga", confidence=0.7), _r("siaga", confidence=0.65), _r("normal")]
    assert confirm_water_status("normal", sure, "pompa_out") == ("siaga", False)


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


def _trash(*levels: str, confidence: float = 0.8, quality: str = "good") -> list[Reading]:
    """Penilaian sampah, yang terbaru lebih dulu."""
    return [Reading("normal", "tidak_relevan", confidence, quality, "sama", level) for level in levels]


def test_a_few_heavy_trash_readings_do_not_make_it_official():
    assert smoothing.confirm_trash("sedikit", _trash("banyak", "sedikit", "sedikit", "sedikit")) == "sedikit"
    assert smoothing.confirm_trash("sedikit", _trash("banyak", "banyak", "banyak", "sedikit", "sedikit", "sedikit")) == "sedikit"
    assert smoothing.confirm_trash(None, _trash("banyak")) == "sedikit"


def test_four_of_the_last_six_make_heavy_trash_official():
    assert smoothing.confirm_trash("sedikit", _trash("banyak", "sedikit", "banyak", "banyak", "sedikit", "banyak")) == "banyak"
    assert smoothing.confirm_trash("sedikit", _trash("banyak", "banyak", "banyak", "banyak")) == "banyak"
    # Yang lebih lama dari enam penilaian terakhir tidak ikut dihitung.
    assert smoothing.confirm_trash("sedikit", _trash(*["sedikit"] * 6, *["banyak"] * 6)) == "sedikit"


def test_heavy_trash_stays_until_only_one_of_six_says_so():
    assert smoothing.confirm_trash("banyak", _trash("sedikit", "banyak", "sedikit", "sedikit", "sedikit", "banyak")) == "banyak"
    assert smoothing.confirm_trash("banyak", _trash("sedikit", "sedikit", "sedikit", "sedikit", "sedikit", "banyak")) == "sedikit"
    # Tanpa status "banyak" sebelumnya, dua dari enam belum cukup.
    assert smoothing.confirm_trash("sedikit", _trash("sedikit", "banyak", "sedikit", "sedikit", "sedikit", "banyak")) == "sedikit"


def test_unsure_or_unusable_readings_are_not_counted_for_trash():
    unsure = _trash("banyak", "banyak", "banyak", "banyak", confidence=0.4)
    assert smoothing.confirm_trash("sedikit", unsure) == "sedikit"
    blurry = _trash("banyak", "banyak", "banyak", "banyak", quality="poor")
    assert smoothing.confirm_trash("tidak_terlihat", blurry) == "tidak_terlihat"
    mixed = [*_trash("tidak_dapat_dinilai"), *_trash("banyak", "banyak", "banyak", "banyak")]
    assert smoothing.confirm_trash("sedikit", mixed) == "banyak"
    assert smoothing.confirm_trash("sedikit", []) == "sedikit"


def test_lighter_levels_follow_the_majority_and_roads_stay_not_applicable():
    assert smoothing.confirm_trash("sedikit", _trash("tidak_terlihat", "sedikit", "tidak_terlihat", "tidak_terlihat")) == "tidak_terlihat"
    assert smoothing.confirm_trash("tidak_terlihat", _trash("sedikit", "tidak_terlihat")) == "sedikit"  # seri: yang terbaru
    assert smoothing.confirm_trash(None, _trash("tidak_relevan")) == "tidak_relevan"


def test_unusable_reason_explains_every_reading_level_of_ignores():
    reason = smoothing.unusable_reason
    assert reason(_r("normal"), "sungai") is None
    assert reason(_r("waspada", confidence=0.7), "sungai") is None
    assert "kurang jelas" in reason(_r("normal", quality="poor"), "sungai")
    assert "rendah" in reason(_r("normal", confidence=0.4), "sungai")
    assert "tidak dapat menilai" in reason(_r("tidak_dapat_dinilai"), "sungai")
    assert "belum cukup" in reason(_r("awas", confidence=0.6), "pompa_out")
    contradicting = Reading(status="siaga", road_flood="tidak_relevan", confidence=0.9, quality="good", change_vs_reference="sama")
    assert "foto kondisi normal" in reason(contradicting, "sungai")
    # Aturan yang sama dengan level_of: ada alasan berarti tidak dihitung, tanpa alasan berarti dihitung.
    for reading in [_r("normal"), _r("awas", confidence=0.6), _r("normal", quality="poor"), contradicting, _r("siaga", confidence=0.66)]:
        assert (reason(reading, "sungai") is None) == (smoothing.level_of(reading, "sungai") is not None)
