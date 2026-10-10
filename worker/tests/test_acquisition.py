import numpy as np

from semarsight_worker import acquisition
from semarsight_worker.models import FrameState


def _frame(seed: int) -> np.ndarray:
    return np.random.default_rng(seed).integers(0, 256, size=(72, 128, 3), dtype=np.uint8)


def test_dhash_is_stable_for_identical_frames():
    assert acquisition.hamming(acquisition.dhash(_frame(1)), acquisition.dhash(_frame(1))) == 0


def test_dhash_differs_for_different_frames():
    assert acquisition.hamming(acquisition.dhash(_frame(1)), acquisition.dhash(_frame(2))) > 10


def test_dhash_tolerates_small_noise():
    base = _frame(1)
    noisy = np.clip(base.astype(np.int16) + np.random.default_rng(9).integers(-2, 3, base.shape), 0, 255)
    distance = acquisition.hamming(acquisition.dhash(base), acquisition.dhash(noisy.astype(np.uint8)))
    assert distance <= acquisition.FROZEN_MAX_DISTANCE


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


def test_frame_states_survive_a_restart(tmp_path):
    path = tmp_path / "_state" / "frame_states.json"
    states = {"cam-a": FrameState(hash=0xFFFF0000FFFF0000, still_cycles=2)}
    acquisition.save_frame_states(path, states)
    assert acquisition.load_frame_states(path) == states


def test_unreadable_frame_states_start_empty(tmp_path):
    path = tmp_path / "frame_states.json"
    path.write_text("bukan json", encoding="utf-8")
    assert acquisition.load_frame_states(path) == {}
