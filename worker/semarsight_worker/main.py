"""Entrypoint worker: satu siklus (`--once`) atau berjalan terus dengan penjadwal.

Contoh:
    python -m semarsight_worker.main --once --limit 3
    python -m semarsight_worker.main --once --only-camera 3281
    python -m semarsight_worker.main
"""

from __future__ import annotations

import argparse
import logging
import shutil
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any

from apscheduler.schedulers.blocking import BlockingScheduler

from . import acquisition, housekeeping, quality, storage
from .config import Settings, get_settings
from .db import Database
from .models import CameraResult, CameraRow, CycleStats, FrameState

log = logging.getLogger("semarsight_worker")

FRAME_STATE_FILE = "_state/frame_states.json"


def process_camera(
    cam: CameraRow, previous: FrameState | None, settings: Settings, database: Database
) -> CameraResult:
    """Ambil dan nilai satu frame. Kegagalan apa pun berakhir sebagai hasil `dead`, bukan exception."""
    checked_at = datetime.now(timezone.utc)
    try:
        grab = acquisition.grab_frame(
            cam.stream_url,
            timeout_seconds=settings.frame_timeout_seconds,
            user_agent=settings.http_user_agent,
        )
        if grab.frame is None:
            return CameraResult(cam, checked_at, "dead", grab.latency_ms, grab.error)

        health, frame_state = acquisition.check_health(grab.frame, previous)
        result = CameraResult(cam, checked_at, health, grab.latency_ms, frame_state=frame_state)
        if not database.dry_run:
            # Frame beku tetap diarsipkan: ambang deteksi beku masih perlu dikalibrasi dari data ini.
            result.local_path = storage.save_local(settings.frames_dir, cam.id, grab.frame, checked_at)
        if health != "live":
            return result

        result.quality = quality.assess(grab.frame)
        try:
            path = storage.latest_path(cam.id)
            database.upload_snapshot(path, storage.encode_latest(grab.frame))
            result.snapshot_path = path
        except Exception as exc:  # noqa: BLE001 - unggahan gagal tidak boleh membatalkan pembacaan
            result.error = f"unggah snapshot gagal: {exc}"[:300]
            log.warning("%s: %s", cam.name, result.error)
        return result
    except Exception as exc:  # noqa: BLE001 - satu kamera tidak boleh menghentikan siklus
        log.exception("%s: error tak terduga", cam.name)
        return CameraResult(cam, checked_at, "dead", error=f"{type(exc).__name__}: {exc}"[:300])


def run_cycle(
    settings: Settings,
    database: Database,
    frame_states: dict[str, FrameState],
    *,
    only: list[str] | None = None,
    limit: int | None = None,
) -> CycleStats:
    started_at = datetime.now(timezone.utc)
    started = time.monotonic()

    cameras = _select_cameras(database.active_cameras(), only, limit)
    failures = database.failure_counts()

    with ThreadPoolExecutor(max_workers=settings.max_concurrency) as pool:
        results = list(
            pool.map(lambda cam: process_camera(cam, frame_states.get(cam.id), settings, database), cameras)
        )

    for result in results:
        if result.frame_state is not None:
            frame_states[result.camera.id] = result.frame_state
        log.debug(
            "%-32s %-6s %5s ms %s",
            result.camera.name[:32],
            result.health,
            result.latency_ms,
            result.error or (result.quality.quality if result.quality else ""),
        )

    database.insert_health_checks([_health_row(r) for r in results])
    database.upsert_camera_status([_status_row(r, failures.get(r.camera.id, 0)) for r in results])

    stats = CycleStats(
        started_at=started_at,
        duration_ms=int((time.monotonic() - started) * 1000),
        live=sum(r.health == "live" for r in results),
        frozen=sum(r.health == "frozen" for r in results),
        dead=sum(r.health == "dead" for r in results),
    )
    housekeeping.heartbeat(database, stats)
    log.info(
        "siklus selesai: %d kamera (live=%d frozen=%d dead=%d) dalam %.1f detik%s",
        stats.total, stats.live, stats.frozen, stats.dead, stats.duration_ms / 1000,
        " [dry-run]" if database.dry_run else "",
    )  # fmt: skip
    return stats


def _select_cameras(cameras: list[CameraRow], only: list[str] | None, limit: int | None) -> list[CameraRow]:
    if only:
        wanted = set(only)
        cameras = [c for c in cameras if c.id in wanted or str(c.source_link_id) in wanted]
        missing = wanted - {c.id for c in cameras} - {str(c.source_link_id) for c in cameras}
        if missing:
            log.warning("kamera tidak ditemukan atau tidak aktif: %s", ", ".join(sorted(missing)))
    return cameras[:limit] if limit else cameras


def _health_row(result: CameraResult) -> dict[str, Any]:
    return {
        "camera_id": result.camera.id,
        "checked_at": result.checked_at.isoformat(),
        "health": result.health,
        "latency_ms": result.latency_ms,
        "error": result.error,
    }


def _status_row(result: CameraResult, previous_failures: int) -> dict[str, Any]:
    checked_at = result.checked_at.isoformat()
    row: dict[str, Any] = {
        "camera_id": result.camera.id,
        "health": result.health,
        "last_checked_at": checked_at,
        "updated_at": checked_at,
    }
    if result.health != "live":
        row["consecutive_failures"] = previous_failures + 1
        return row

    row["consecutive_failures"] = 0
    row["last_live_at"] = checked_at
    if result.quality is not None:
        row["latest_quality"] = result.quality.quality
        row["is_night"] = result.quality.is_night
    if result.snapshot_path is not None:
        row["latest_snapshot_path"] = result.snapshot_path
        row["latest_snapshot_at"] = checked_at
    return row


def _parse_args(argv: list[str] | None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(prog="semarsight_worker", description="Worker SemarSight")
    parser.add_argument("--once", action="store_true", help="jalankan satu siklus lalu keluar")
    parser.add_argument(
        "--only-camera",
        action="append",
        metavar="ID",
        help="batasi ke kamera tertentu (UUID atau source_link_id); bisa diulang",
    )
    parser.add_argument("--limit", type=int, metavar="N", help="batasi ke N kamera pertama (untuk uji)")
    parser.add_argument("--dry-run", action="store_true", help="tidak menulis ke database, Storage, maupun disk")
    parser.add_argument("--verbose", action="store_true", help="tampilkan hasil per kamera")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
        stream=sys.stdout,
    )
    for noisy in ("httpx", "httpcore", "hpack", "apscheduler"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    if shutil.which("ffmpeg") is None:
        log.error("ffmpeg tidak ditemukan di PATH; pasang ffmpeg lebih dulu")
        return 1

    settings = get_settings()
    database = Database(settings, dry_run=args.dry_run)
    state_path = settings.frames_dir / FRAME_STATE_FILE
    frame_states = acquisition.load_frame_states(state_path)

    def cycle() -> None:
        try:
            run_cycle(settings, database, frame_states, only=args.only_camera, limit=args.limit)
        except Exception:  # noqa: BLE001 - siklus berikutnya harus tetap berjalan
            log.exception("siklus gagal")
        finally:
            if not args.dry_run:
                acquisition.save_frame_states(state_path, frame_states)

    if args.once:
        cycle()
        return 0

    log.info("worker mulai: siklus tiap %d detik, konkurensi %d", settings.cycle_seconds, settings.max_concurrency)
    scheduler = BlockingScheduler(timezone="UTC")
    scheduler.add_job(
        cycle,
        "interval",
        seconds=settings.cycle_seconds,
        next_run_time=datetime.now(timezone.utc),
        max_instances=1,
        coalesce=True,
    )
    scheduler.add_job(
        housekeeping.prune_frames,
        "interval",
        hours=24,
        next_run_time=datetime.now(timezone.utc),
        args=[settings.frames_dir, settings.frames_retention_days],
    )
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        log.info("worker dihentikan")
    return 0


if __name__ == "__main__":
    sys.exit(main())
