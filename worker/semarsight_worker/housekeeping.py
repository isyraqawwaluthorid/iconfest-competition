"""Heartbeat worker dan retensi frame lokal."""

from __future__ import annotations

import logging
import shutil
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from . import __version__
from .db import Database
from .models import CycleStats

log = logging.getLogger(__name__)


def heartbeat(database: Database, stats: CycleStats) -> None:
    """Tulis tanda hidup worker; web menampilkan banner jika tanda ini terlalu lama."""
    database.set_system_status(
        "worker",
        {
            "last_seen": datetime.now(timezone.utc).isoformat(),
            "cycle_started_at": stats.started_at.isoformat(),
            "cycle_ms": stats.duration_ms,
            "cameras": {"live": stats.live, "frozen": stats.frozen, "dead": stats.dead},
            "version": __version__,
        },
    )


def prune_frames(frames_dir: Path, retention_days: int, today: date | None = None) -> int:
    """Hapus folder harian `{camera_id}/{YYYYMMDD}` yang lebih tua dari masa retensi."""
    today = today or datetime.now(timezone.utc).date()
    cutoff = today - timedelta(days=retention_days)
    removed = 0
    for day_dir in frames_dir.glob("*/*"):
        if not day_dir.is_dir():
            continue
        try:
            day = datetime.strptime(day_dir.name, "%Y%m%d").date()
        except ValueError:
            continue
        if day < cutoff:
            shutil.rmtree(day_dir, ignore_errors=True)
            removed += 1
    if removed:
        log.info("retensi: %d folder frame lebih tua dari %s dihapus", removed, cutoff.isoformat())
    return removed
