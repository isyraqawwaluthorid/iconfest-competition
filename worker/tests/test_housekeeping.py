import logging
from datetime import date, datetime, timezone

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


def test_log_file_receives_records_and_survives_pruning(tmp_path):
    path = housekeeping.log_to_file(tmp_path)
    handler = logging.getLogger().handlers[-1]
    try:
        logging.getLogger("semarsight_worker.test").warning("siklus gagal")
        handler.flush()
        assert "siklus gagal" in path.read_text(encoding="utf-8")
        assert housekeeping.prune_frames(tmp_path, retention_days=7, today=date(2026, 10, 20)) == 0
        assert path.exists()
    finally:
        logging.getLogger().removeHandler(handler)
        handler.close()


class FakeStorage:
    def __init__(self, folders: dict[str, list[str]]) -> None:
        self.folders = folders
        self.removed: list[str] = []

    def list_objects(self, folder: str) -> list[str]:
        if folder == "readings":
            return sorted({key.split("/")[1] for key in self.folders})
        return self.folders[folder]

    def remove_objects(self, paths: list[str]) -> None:
        self.removed += paths


def test_evidence_older_than_retention_is_removed_from_storage():
    database = FakeStorage(
        {
            "readings/cam-a": ["20261008T235959.jpg", "20261009T000000.jpg", "catatan.txt"],
            "readings/cam-b": ["20261001T120000.jpg", "20261011T120000.jpg"],
        }
    )
    removed = housekeeping.prune_evidence(database, 3, now=datetime(2026, 10, 12, tzinfo=timezone.utc))
    assert removed == 2
    assert database.removed == ["readings/cam-a/20261008T235959.jpg", "readings/cam-b/20261001T120000.jpg"]
