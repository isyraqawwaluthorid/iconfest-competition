import numpy as np

from semarsight_worker import acquisition
from semarsight_worker.models import FrameState


def _frame(seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, 256, size=(360, 640, 3), dtype=np.uint8)


def _static_scene_with_sensor_noise(cycle: int) -> np.ndarray:
    """Adegan yang sama persis tiap siklus, hanya derau sensor kecil yang berbeda."""
    scene = np.full((360, 640, 3), 90, dtype=np.int16)
    scene[100:260, 200:440] = 160
    noise = np.random.default_rng(cycle).normal(0, 2, scene.shape)
    return np.clip(scene + noise, 0, 255).astype(np.uint8)


def test_fingerprint_is_stable_for_identical_frames():
    assert acquisition.fingerprint(_frame(1)) == acquisition.fingerprint(_frame(1))


def test_fingerprint_differs_for_different_frames():
    assert acquisition.fingerprint(_frame(1)) != acquisition.fingerprint(_frame(2))


def test_first_frame_is_live():
    health, state = acquisition.check_health(_frame(1), None)
    assert health == "live"
    assert state.still_cycles == 0


def test_frozen_only_after_three_identical_cycles():
    frame = _frame(1)
    state = None
    seen = []
    for _ in range(5):
        health, state = acquisition.check_health(frame, state)
        seen.append(health)
    assert seen == ["live", "live", "live", "frozen", "frozen"]


def test_changed_frame_resets_the_frozen_count():
    frame = _frame(1)
    state = None
    for _ in range(4):
        _, state = acquisition.check_health(frame, state)
    health, state = acquisition.check_health(_frame(2), state)
    assert health == "live"
    assert state.still_cycles == 0


def test_static_scene_with_sensor_noise_stays_live():
    state = None
    seen = []
    for cycle in range(8):
        health, state = acquisition.check_health(_static_scene_with_sensor_noise(cycle), state)
        seen.append(health)
    assert seen == ["live"] * 8


def test_frame_states_survive_a_restart(tmp_path):
    path = tmp_path / "_state" / "frame_states.json"
    states = {"cam-a": FrameState(hash=0xFFFF0000FFFF0000, still_cycles=2)}
    acquisition.save_frame_states(path, states)
    assert acquisition.load_frame_states(path) == states


def test_unreadable_frame_states_start_empty(tmp_path):
    path = tmp_path / "frame_states.json"
    path.write_text("bukan json", encoding="utf-8")
    assert acquisition.load_frame_states(path) == {}
