"""Penyimpanan frame: arsip lokal resolusi penuh dan versi kecil untuk snapshot terbaru."""

from __future__ import annotations

from datetime import datetime
from pathlib import Path

import cv2
import numpy as np

LOCAL_JPEG_QUALITY = 85
LATEST_JPEG_QUALITY = 80
LATEST_MAX_WIDTH = 960


def save_local(frames_dir: Path, camera_id: str, frame: np.ndarray, at: datetime) -> Path:
    """Simpan frame ke `{frames_dir}/{camera_id}/{YYYYMMDD}/{HHMMSS}.jpg` (waktu UTC)."""
    path = frames_dir / camera_id / at.strftime("%Y%m%d") / f"{at.strftime('%H%M%S')}.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(_encode_jpeg(frame, LOCAL_JPEG_QUALITY))
    return path


def encode_latest(frame: np.ndarray) -> bytes:
    """JPEG berukuran web (lebar maks. 960 px) untuk `latest/{camera_id}.jpg` di Storage."""
    height, width = frame.shape[:2]
    if width > LATEST_MAX_WIDTH:
        scale = LATEST_MAX_WIDTH / width
        frame = cv2.resize(frame, (LATEST_MAX_WIDTH, round(height * scale)), interpolation=cv2.INTER_AREA)
    return _encode_jpeg(frame, LATEST_JPEG_QUALITY)


def latest_path(camera_id: str) -> str:
    return f"latest/{camera_id}.jpg"


EVIDENCE_FOLDER = "readings"
EVIDENCE_TIME_FORMAT = "%Y%m%dT%H%M%S"


def evidence_path(camera_id: str, at: datetime) -> str:
    """Lokasi di Storage untuk gambar yang dinilai AI, agar web bisa menampilkannya sebagai bukti."""
    return f"{EVIDENCE_FOLDER}/{camera_id}/{at.strftime(EVIDENCE_TIME_FORMAT)}.jpg"


def _encode_jpeg(frame: np.ndarray, quality: int) -> bytes:
    ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    if not ok:
        raise ValueError("gagal meng-encode frame ke JPEG")
    return buffer.tobytes()
