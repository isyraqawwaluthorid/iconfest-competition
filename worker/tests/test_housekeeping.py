from datetime import date

from semarsight_worker import housekeeping


def test_prune_removes_only_folders_older_than_retention(tmp_path):
    for day in ("20260920", "20260926", "20261010"):
        (tmp_path / "cam-a" / day).mkdir(parents=True)
    (tmp_path / "_state").mkdir()

    removed = housekeeping.prune_frames(tmp_path, retention_days=14, today=date(2026, 10, 10))

    assert removed == 1
    assert not (tmp_path / "cam-a" / "20260920").exists()
    assert (tmp_path / "cam-a" / "20260926").exists()
    assert (tmp_path / "cam-a" / "20261010").exists()
    assert (tmp_path / "_state").exists()
