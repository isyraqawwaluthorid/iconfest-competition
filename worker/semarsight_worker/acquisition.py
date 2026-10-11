"""Akuisisi frame dari stream HLS dan cek kesehatan kamera (live / frozen / dead)."""

from __future__ import annotations

import hashlib
import json
import logging
import subprocess
import time
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .models import FrameState, Health

log = logging.getLogger(__name__)

RW_TIMEOUT_MICROSECONDS = 15_000_000
FINGERPRINT_SIZE = (160, 90)
SERVER_RESPONSE_MARKER = "Server returned"  # awalan pesan ffmpeg saat server membalas dengan kode HTTP
FROZEN_CYCLES = 3  # berapa siklus berturut-turut gambar sama sebelum dinyatakan beku


@dataclass(frozen=True)
class GrabResult:
    frame: np.ndarray | None
    latency_ms: int
    error: str | None = None


def grab_frame(stream_url: str, *, timeout_seconds: int, user_agent: str) -> GrabResult:
    """Ambil satu frame dengan ffmpeg. Tidak pernah melempar exception untuk kegagalan stream."""
    command = [
        "ffmpeg", "-nostdin", "-loglevel", "error",
        "-rw_timeout", str(RW_TIMEOUT_MICROSECONDS),
        "-user_agent", user_agent,
        "-i", stream_url,
        "-frames:v", "1", "-f", "image2pipe", "-vcodec", "mjpeg", "-q:v", "2", "-",
    ]  # fmt: skip
    started = time.monotonic()
    try:
        proc = subprocess.run(command, capture_output=True, timeout=timeout_seconds, check=False)
    except subprocess.TimeoutExpired:
        return GrabResult(None, _elapsed_ms(started), f"timeout setelah {timeout_seconds} detik")
    latency_ms = _elapsed_ms(started)

    if proc.returncode != 0 or not proc.stdout:
        return GrabResult(None, latency_ms, _last_line(proc.stderr) or f"ffmpeg exit {proc.returncode}")

    frame = cv2.imdecode(np.frombuffer(proc.stdout, dtype=np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return GrabResult(None, latency_ms, "frame tidak bisa di-decode")
    return GrabResult(frame, latency_ms)


def server_answered(error: str | None) -> bool:
    """Apakah kegagalan ini jawaban dari server CCTV (mis. 404), bukan putusnya jaringan di sisi worker."""
    return error is not None and SERVER_RESPONSE_MARKER in error


def fingerprint(frame: np.ndarray) -> int:
    """Sidik 64-bit dari versi kecil frame; hanya sama jika gambarnya persis sama.

    Adegan yang diam (rumah pompa, jalan sepi malam hari) tetap menghasilkan sidik berbeda
    tiap siklus karena derau sensor dan jam di pojok gambar ikut berubah. Sidik yang sama
    berarti stream mengirim ulang frame yang sama.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    small = cv2.resize(gray, FINGERPRINT_SIZE, interpolation=cv2.INTER_AREA)
    return int.from_bytes(hashlib.blake2b(small.tobytes(), digest_size=8).digest(), "big")


def check_health(frame: np.ndarray, previous: FrameState | None) -> tuple[Health, FrameState]:
    """Tentukan `live` atau `frozen` dari frame yang berhasil diambil.

    Kamera dinyatakan beku jika gambarnya persis sama dengan siklus sebelumnya
    selama `FROZEN_CYCLES` siklus berturut-turut.
    """
    current = fingerprint(frame)
    still_cycles = 0
    if previous is not None and current == previous.hash:
        still_cycles = previous.still_cycles + 1
    health: Health = "frozen" if still_cycles >= FROZEN_CYCLES else "live"
    return health, FrameState(hash=current, still_cycles=still_cycles)


def load_frame_states(path: Path) -> dict[str, FrameState]:
    """Muat jejak frame dari disk agar deteksi beku bertahan saat worker dimulai ulang."""
    if not path.exists():
        return {}
    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
        return {cam_id: FrameState(int(v["hash"], 16), int(v["still_cycles"])) for cam_id, v in raw.items()}
    except (OSError, ValueError, KeyError, TypeError) as exc:
        log.warning("jejak frame di %s tidak terbaca, mulai dari kosong: %s", path, exc)
        return {}


def save_frame_states(path: Path, states: dict[str, FrameState]) -> None:
    payload = {cam_id: {"hash": f"{s.hash:016x}", "still_cycles": s.still_cycles} for cam_id, s in states.items()}
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload), encoding="utf-8")


def _elapsed_ms(started: float) -> int:
    return int((time.monotonic() - started) * 1000)


def _last_line(stderr: bytes) -> str:
    lines = stderr.decode("utf-8", errors="replace").strip().splitlines()
    return lines[-1][:300] if lines else ""
