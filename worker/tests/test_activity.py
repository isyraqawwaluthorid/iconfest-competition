from datetime import datetime, timedelta, timezone

from semarsight_worker.fusion.activity import MIN_SAMPLES, Profile

NOON_WIB = datetime(2026, 10, 12, 5, 0, tzinfo=timezone.utc)  # 12.00 WIB


def _hour(profile: Profile, start: datetime, vehicles: float, persons: float, samples: int = 12) -> None:
    for i in range(samples):
        profile.add("cam", start + timedelta(minutes=5 * i), vehicles, persons)


def test_average_per_frame_lands_in_the_local_hour():
    profile = Profile()
    _hour(profile, NOON_WIB, 10, 4)
    _hour(profile, NOON_WIB - timedelta(days=1), 20, 6)
    camera = profile.snapshot(NOON_WIB)["cameras"]["cam"]
    assert camera["vehicles"][12] == 15.0
    assert camera["persons"][12] == 5.0
    assert camera["vehicles"][5] is None  # jam UTC bukan jam setempat


def test_an_hour_with_too_few_samples_is_empty_not_zero():
    profile = Profile()
    _hour(profile, NOON_WIB, 10, 4, samples=MIN_SAMPLES - 1)
    assert profile.snapshot(NOON_WIB)["cameras"]["cam"]["vehicles"][12] is None


def test_snapshot_counts_distinct_local_days_and_remembers_the_start():
    profile = Profile()
    _hour(profile, NOON_WIB, 10, 4)
    _hour(profile, NOON_WIB - timedelta(days=2), 10, 4)
    profile.add("cam", datetime(2026, 10, 12, 16, 55, tzinfo=timezone.utc), 1, 0)  # 23.55 WIB, masih 12 Okt
    profile.add("cam", datetime(2026, 10, 12, 17, 5, tzinfo=timezone.utc), 1, 0)  # 00.05 WIB, sudah 13 Okt
    snapshot = profile.snapshot(NOON_WIB)
    assert snapshot["days"] == 3
    assert snapshot["since"] == (NOON_WIB - timedelta(days=2)).isoformat(timespec="seconds")


def test_written_once_then_again_after_an_hour():
    profile = Profile()
    assert profile.due(NOON_WIB)
    profile.snapshot(NOON_WIB)
    assert profile.due(NOON_WIB)  # belum ditandai tersimpan: bila penyimpanan gagal, siklus berikutnya mencoba lagi
    profile.mark_written(NOON_WIB)
    assert not profile.due(NOON_WIB + timedelta(minutes=55))
    assert profile.due(NOON_WIB + timedelta(hours=1))


def test_the_usual_crowd_leaves_out_today():
    profile = Profile()
    _hour(profile, NOON_WIB, 30, 30)  # hari ini, jam yang sedang berjalan
    snapshot = profile.snapshot(NOON_WIB + timedelta(minutes=50))
    assert snapshot["usual_days"] == 0
    assert snapshot["cameras"]["cam"]["persons"][12] == 30.0
    assert snapshot["cameras"]["cam"]["persons_usual"][12] is None  # belum ada hari lain: tidak ada pembanding
    _hour(profile, NOON_WIB - timedelta(days=1), 10, 10)
    _hour(profile, NOON_WIB - timedelta(days=2), 10, 20)
    snapshot = profile.snapshot(NOON_WIB + timedelta(minutes=50))
    assert snapshot["usual_days"] == 2
    assert snapshot["cameras"]["cam"]["persons_usual"][12] == 15.0
