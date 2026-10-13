import pytest

from semarsight_worker.analyzers import traffic
from semarsight_worker.analyzers.traffic import Counts, Detection, count_detections, inference_size

WIDTH, HEIGHT = 1000, 500


@pytest.mark.parametrize(
    ("width", "height", "expected"),
    [(352, 288, 640), (640, 360, 640), (704, 576, 704), (1280, 720, 1280), (1920, 1080, 1280), (3840, 1080, 1280)],
)
def test_inference_size_follows_camera_resolution_within_bounds(width, height, expected):
    assert inference_size(width, height) == expected


def _box(class_id: int, foot_x: float, foot_y: float) -> Detection:
    """Kotak 40x40 px yang titik tengah-bawahnya berada di (foot_x, foot_y)."""
    return Detection(class_id, foot_x - 20, foot_y - 40, foot_x + 20, foot_y)


def test_counts_each_class_and_totals_vehicles():
    detections = [_box(2, 100, 100), _box(2, 200, 100), _box(3, 300, 100), _box(5, 400, 100), _box(7, 500, 100),
                  _box(0, 600, 100), _box(1, 700, 100)]  # fmt: skip
    counts = count_detections(detections, WIDTH, HEIGHT)
    assert counts == Counts(persons=1, bicycles=1, cars=2, motorcycles=1, buses=1, trucks=1)
    assert counts.vehicle_total == 5


def test_ignores_classes_outside_the_counted_set():
    assert count_detections([_box(16, 100, 100)], WIDTH, HEIGHT) == Counts()


def test_roi_keeps_only_objects_standing_inside_the_polygon():
    left_half = {"points": [[0.0, 0.0], [0.5, 0.0], [0.5, 1.0], [0.0, 1.0]]}
    detections = [_box(2, 250, 300), _box(2, 750, 300), _box(3, 499, 499)]
    counts = count_detections(detections, WIDTH, HEIGHT, left_half)
    assert counts.cars == 1
    assert counts.motorcycles == 1


def test_roi_uses_the_bottom_centre_not_the_box_centre():
    lower_half = {"points": [[0.0, 0.5], [1.0, 0.5], [1.0, 1.0], [0.0, 1.0]]}
    tall_box = Detection(2, 480, 100, 520, 260)  # pusat kotak di atas garis, kaki di bawahnya
    assert count_detections([tall_box], WIDTH, HEIGHT, lower_half).cars == 1


def test_incomplete_roi_is_treated_as_no_roi():
    assert count_detections([_box(2, 900, 100)], WIDTH, HEIGHT, {"points": [[0, 0], [1, 1]]}).cars == 1


def test_a_person_on_a_motorcycle_is_not_counted_as_a_person():
    motorcycle = Detection(3, 100, 200, 160, 300)
    rider = Detection(0, 105, 140, 155, 280)  # kaki di dalam kotak motor, sebagian besar kotaknya menumpuk
    pedestrian = Detection(0, 400, 150, 440, 300)
    counts = traffic.count_detections([motorcycle, rider, pedestrian], 960, 540)
    assert (counts.persons, counts.motorcycles) == (1, 1)


def test_at_most_two_riders_per_motorcycle_and_bicycles_count_too():
    motorcycle = Detection(3, 100, 200, 200, 300)
    on_it = [Detection(0, 100 + 20 * i, 130, 150 + 20 * i, 290) for i in range(3)]
    assert traffic.count_detections([motorcycle, *on_it], 960, 540).persons == 1
    bicycle, cyclist = Detection(1, 500, 200, 560, 300), Detection(0, 505, 120, 555, 290)
    assert traffic.count_detections([bicycle, cyclist], 960, 540).persons == 0


def test_a_person_beside_or_above_a_motorcycle_is_still_a_pedestrian():
    motorcycle = Detection(3, 100, 200, 160, 300)
    beside = Detection(0, 170, 140, 210, 300)  # di samping: kakinya di luar kotak motor
    behind = Detection(0, 110, 60, 150, 190)  # di belakang, lebih jauh: kakinya di atas kotak motor
    assert traffic.count_detections([motorcycle, beside, behind], 960, 540).persons == 2


def test_method_tag_names_the_model_and_the_counting_rules():
    assert traffic.method_tag("yolo11s.pt") == f"yolo11s.pt/r{traffic.COUNT_RULES}"
