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
from .analyzers import traffic
from .config import Settings, get_settings
from .db import Database
from .fusion import baseline
from .models import CameraResult, CameraRow, CycleStats, FrameState, QualityResult, TrafficReading

log = logging.getLogger("semarsight_worker")

FRAME_STATE_FILE = "_state/frame_states.json"
COUNTING_MODULES = {"traffic", "crowd"}
OUTAGE_MIN_CAMERAS = 10
OUTAGE_SHARE = 0.4  # porsi kamera tanpa jawaban server yang menandakan gangguan jaringan worker


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

        result.quality = quality.assess(grab.frame, checked_at)
        try:
            path = storage.latest_path(cam.id)
            database.upload_snapshot(path, storage.encode_latest(grab.frame))
            result.snapshot_path = path
        except Exception as exc:  # noqa: BLE001 - unggahan gagal tidak boleh membatalkan pembacaan
            result.error = f"unggah snapshot gagal: {exc}"[:300]
            log.warning("%s: %s", cam.name, result.error)

        if COUNTING_MODULES & set(cam.modules):
            try:
                result.counts = traffic.count_objects(
                    grab.frame, cam.traffic_roi, model_name=settings.yolo_model, conf=settings.yolo_conf
                )
            except Exception:  # noqa: BLE001 - kamera tetap live walau penghitungan gagal
                log.exception("%s: penghitungan YOLO gagal", cam.name)
        return result
    except Exception as exc:  # noqa: BLE001 - satu kamera tidak boleh menghentikan siklus
        log.exception("%s: error tak terduga", cam.name)
        return CameraResult(cam, checked_at, "dead", error=f"{type(exc).__name__}: {exc}"[:300])


def run_cycle(
    settings: Settings,
    database: Database,
    frame_states: dict[str, FrameState],
    history: baseline.RollingHistory,
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
        if result.counts is not None:
            result.traffic = _evaluate_traffic(result, history)
        log.debug("%-32s %-6s %5s ms %s", result.camera.name[:32], result.health, result.latency_ms, _detail(result))

    recordable, unreachable = split_unreachable(results)
    if unreachable:
        log.warning(
            "jaringan worker bermasalah: %d dari %d kamera tidak terjangkau; tidak dicatat sebagai kamera mati",
            len(unreachable), len(results),
        )  # fmt: skip

    database.insert_health_checks([_health_row(r) for r in recordable])
    database.insert_traffic_readings([_traffic_row(r, settings.yolo_model) for r in recordable if r.traffic])
    database.upsert_camera_status([_status_row(r, failures.get(r.camera.id, 0)) for r in recordable])

    stats = CycleStats(
        started_at=started_at,
        duration_ms=int((time.monotonic() - started) * 1000),
        live=sum(r.health == "live" for r in recordable),
        frozen=sum(r.health == "frozen" for r in recordable),
        dead=sum(r.health == "dead" for r in recordable),
        unreachable=len(unreachable),
    )
    housekeeping.heartbeat(database, stats)
    log.info(
        "siklus selesai: %d kamera (live=%d frozen=%d dead=%d%s, %d dihitung YOLO) dalam %.1f detik%s",
        stats.total, stats.live, stats.frozen, stats.dead,
        f" tak-terjangkau={stats.unreachable}" if stats.unreachable else "",
        sum(r.traffic is not None for r in recordable),
        stats.duration_ms / 1000, " [dry-run]" if database.dry_run else "",
    )  # fmt: skip
    return stats


def split_unreachable(results: list[CameraResult]) -> tuple[list[CameraResult], list[CameraResult]]:
    """Pisahkan kegagalan akibat jaringan worker dari hasil yang layak dicatat.

    Kamera yang gagal tanpa jawaban dari server (koneksi diputus, timeout) biasanya hanya segelintir
    per siklus. Jika jumlahnya melewati `OUTAGE_SHARE` dari semua kamera, penyebabnya hampir pasti
    jaringan di sisi worker, sehingga kegagalan itu tidak dicatat sebagai kamera mati.
    """
    no_answer = [r for r in results if r.health == "dead" and not acquisition.server_answered(r.error)]
    if len(results) < OUTAGE_MIN_CAMERAS or len(no_answer) <= OUTAGE_SHARE * len(results):
        return results, []
    unreachable_ids = {id(r) for r in no_answer}
    return [r for r in results if id(r) not in unreachable_ids], no_answer


def seed_history(history: baseline.RollingHistory, database: Database) -> None:
    """Isi baseline bergulir dari pembacaan 24 jam terakhir, agar tidak mulai dari nol saat restart."""
    metric_by_camera = {cam.id: _density_metric(cam) for cam in database.active_cameras()}
    rows = database.recent_traffic(datetime.now(timezone.utc) - baseline.WINDOW)
    for row in rows:
        metric = metric_by_camera.get(row["camera_id"])
        if metric is None or not _usable_for_baseline(row["quality"], row["is_night"]):
            continue
        history.add(row["camera_id"], datetime.fromisoformat(row["captured_at"]), row[metric])
    log.info("baseline bergulir diisi dari %d pembacaan 24 jam terakhir", len(rows))


def _evaluate_traffic(result: CameraResult, history: baseline.RollingHistory) -> TrafficReading:
    """Bandingkan hitungan frame ini dengan baseline kamera, lalu catat ke riwayat bergulir."""
    cam, counts = result.camera, result.counts
    assert counts is not None
    value = getattr(counts, _density_metric(cam))
    base = history.baseline(cam.id, result.checked_at)
    index = round(baseline.density_index(value, base.median), 3) if base else None
    usable = result.quality is None or _usable_for_baseline(result.quality.quality, result.quality.is_night)
    is_anomaly = usable and history.is_anomaly(cam.id, value, base)
    if usable:
        history.add(cam.id, result.checked_at, value)
    return TrafficReading(
        counts=counts,
        density_index=index,
        density_level=baseline.density_level(index),
        baseline_median=base.median if base else None,
        baseline_is_provisional=base.provisional if base else True,
        is_anomaly=is_anomaly,
    )


def _density_metric(cam: CameraRow) -> str:
    """Metrik utama kamera: kendaraan untuk modul lalu lintas, orang untuk ruang publik."""
    return "vehicle_total" if "traffic" in cam.modules else "persons"


def _usable_for_baseline(image_quality: str | None, is_night: bool | None) -> bool:
    """Pembacaan malam berkualitas buruk tidak dipakai untuk baseline maupun anomali."""
    return not (is_night and image_quality == "poor")


def _select_cameras(cameras: list[CameraRow], only: list[str] | None, limit: int | None) -> list[CameraRow]:
    if only:
        wanted = set(only)
        cameras = [c for c in cameras if c.id in wanted or str(c.source_link_id) in wanted]
        missing = wanted - {c.id for c in cameras} - {str(c.source_link_id) for c in cameras}
        if missing:
            log.warning("kamera tidak ditemukan atau tidak aktif: %s", ", ".join(sorted(missing)))
    return cameras[:limit] if limit else cameras


def _detail(result: CameraResult) -> str:
    if result.error:
        return result.error
    parts = [_quality_label(result.quality)]
    if result.traffic:
        counts = result.traffic.counts
        parts.append(f"kendaraan={counts.vehicle_total} orang={counts.persons}")
        parts.append(f"indeks={result.traffic.density_index} ({result.traffic.density_level})")
    return " ".join(p for p in parts if p)


def _quality_label(q: QualityResult | None) -> str:
    return f"{q.quality}{'/malam' if q.is_night else ''}{'/IR' if q.is_ir else ''}" if q else ""


def _health_row(result: CameraResult) -> dict[str, Any]:
    return {
        "camera_id": result.camera.id,
        "checked_at": result.checked_at.isoformat(),
        "health": result.health,
        "latency_ms": result.latency_ms,
        "error": result.error,
    }


def _traffic_row(result: CameraResult, model_name: str) -> dict[str, Any]:
    reading = result.traffic
    assert reading is not None
    counts = reading.counts
    return {
        "camera_id": result.camera.id,
        "captured_at": result.checked_at.isoformat(),
        "cars": counts.cars,
        "motorcycles": counts.motorcycles,
        "buses": counts.buses,
        "trucks": counts.trucks,
        "bicycles": counts.bicycles,
        "persons": counts.persons,
        "vehicle_total": counts.vehicle_total,
        "density_index": reading.density_index,
        "density_level": reading.density_level,
        "baseline_median": reading.baseline_median,
        "is_anomaly": reading.is_anomaly,
        "quality": result.quality.quality if result.quality else None,
        "is_night": result.quality.is_night if result.quality else None,
        "model": model_name,
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
    if result.traffic is not None:
        row["vehicle_count"] = result.traffic.counts.vehicle_total
        row["person_count"] = result.traffic.counts.persons
        row["density_index"] = result.traffic.density_index
        row["density_level"] = result.traffic.density_level
        row["is_anomaly"] = result.traffic.is_anomaly
        row["baseline_is_provisional"] = result.traffic.baseline_is_provisional
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
    for noisy in ("httpx", "httpcore", "hpack", "apscheduler", "urllib3"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    if shutil.which("ffmpeg") is None:
        log.error("ffmpeg tidak ditemukan di PATH; pasang ffmpeg lebih dulu")
        return 1

    settings = get_settings()
    database = Database(settings, dry_run=args.dry_run)
    state_path = settings.frames_dir / FRAME_STATE_FILE
    frame_states = acquisition.load_frame_states(state_path)
    history = baseline.RollingHistory()
    seed_history(history, database)

    def cycle() -> None:
        try:
            run_cycle(settings, database, frame_states, history, only=args.only_camera, limit=args.limit)
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
