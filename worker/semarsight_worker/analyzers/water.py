"""Modul air: deteksi perubahan lokal di area air, lalu penilaian AI vision bila perlu.

AI hanya dipanggil saat area air berubah nyata atau saat heartbeat berkala, dan hanya menerima
potongan gambar kecil berisi area air dengan garis acuan kalibrasi digambar di atasnya.
"""

from __future__ import annotations

import base64
import json
import logging
from dataclasses import dataclass
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2
import httpx
import numpy as np
from pydantic import ValidationError

from ..config import REPO_ROOT
from ..models import CameraRow, QualityResult, VisionResult

log = logging.getLogger(__name__)

RESPONSES_URL = "https://api.openai.com/v1/responses"
PROMPT_PATH = Path(__file__).resolve().parents[1] / "prompts" / "water_vision.md"
SCHEMA_PATH = REPO_ROOT / "ai" / "schemas" / "water_vision.schema.json"
WIB = ZoneInfo("Asia/Jakarta")

CHANGE_WIDTH = 256  # lebar gambar untuk deteksi perubahan
VISION_MAX_WIDTH = 512  # lebar maksimal gambar yang dikirim ke AI
VISION_JPEG_QUALITY = 80
NOISE_MIN_SAMPLES = 6  # skor perubahan yang dibutuhkan sebelum variasi normal kamera dianggap diketahui
NOISE_FACTOR = 2.0
LINE_OPACITY = 0.6
LABEL_SPACING = 14  # jarak vertikal minimal antar label garis, dalam piksel
CROP_MARGIN = 0.04  # ruang ekstra di sekeliling area, dalam porsi lebar/tinggi frame
AI_TIMEOUT_SECONDS = 45
MAX_ATTEMPTS = 2  # satu percobaan ulang, tidak lebih

# Garis acuan: (label di gambar, warna BGR)
LEVEL_STYLE = {
    "normal": ("N", (60, 170, 30)),
    "waspada": ("W", (0, 200, 230)),
    "siaga": ("S", (0, 120, 255)),
    "awas": ("A", (40, 40, 230)),
}

Trigger = str  # "change" | "rain" | "heartbeat"


@dataclass(frozen=True)
class RegionView:
    """Area air satu frame: versi kecil grayscale dan masker poligonnya, untuk deteksi perubahan."""

    gray: np.ndarray
    mask: np.ndarray


def region_points(cam: CameraRow) -> np.ndarray:
    """Poligon area pengamatan (ternormalisasi 0..1): area air ditambah daerah di sekitar garis acuan.

    Garis acuan sering digambar di dinding tepat di luar area air. Selubung cembung dari keduanya
    memastikan dinding tempat air akan naik ikut diamati.
    """
    points = [tuple(p) for p in (cam.roi or {}).get("points", [])]
    for line in cam.reference_lines or []:
        points.extend(tuple(p) for p in line["points"])
    hull = cv2.convexHull(np.array(points, dtype=np.float32))
    return hull.reshape(-1, 2)


def crop_box(points: np.ndarray, width: int, height: int) -> tuple[int, int, int, int]:
    """Kotak pembatas area pengamatan dalam piksel, dengan sedikit ruang di sekelilingnya."""
    x0 = max(0, int((points[:, 0].min() - CROP_MARGIN) * width))
    y0 = max(0, int((points[:, 1].min() - CROP_MARGIN) * height))
    x1 = min(width, int(np.ceil((points[:, 0].max() + CROP_MARGIN) * width)))
    y1 = min(height, int(np.ceil((points[:, 1].max() + CROP_MARGIN) * height)))
    return x0, y0, x1, y1


def region_view(frame: np.ndarray, cam: CameraRow) -> RegionView:
    height, width = frame.shape[:2]
    points = region_points(cam)
    x0, y0, x1, y1 = crop_box(points, width, height)
    crop = cv2.cvtColor(frame[y0:y1, x0:x1], cv2.COLOR_BGR2GRAY)
    mask = np.zeros(crop.shape, dtype=np.uint8)
    polygon = np.round((points * [width, height]) - [x0, y0]).astype(np.int32)
    cv2.fillPoly(mask, [polygon], 255)
    target = (CHANGE_WIDTH, max(1, round(crop.shape[0] * CHANGE_WIDTH / crop.shape[1])))
    return RegionView(
        gray=cv2.resize(crop, target, interpolation=cv2.INTER_AREA),
        mask=cv2.resize(mask, target, interpolation=cv2.INTER_NEAREST) > 0,
    )


def ssim(a: np.ndarray, b: np.ndarray, mask: np.ndarray) -> float:
    """Kemiripan struktur (SSIM) dua gambar grayscale, dirata-rata hanya di dalam masker."""
    a, b = a.astype(np.float64), b.astype(np.float64)
    c1, c2 = (0.01 * 255) ** 2, (0.03 * 255) ** 2
    blur = lambda image: cv2.GaussianBlur(image, (11, 11), 1.5)  # noqa: E731
    mu_a, mu_b = blur(a), blur(b)
    var_a, var_b = blur(a * a) - mu_a**2, blur(b * b) - mu_b**2
    cov = blur(a * b) - mu_a * mu_b
    score = ((2 * mu_a * mu_b + c1) * (2 * cov + c2)) / ((mu_a**2 + mu_b**2 + c1) * (var_a + var_b + c2))
    return float(score[mask].mean()) if mask.any() else float(score.mean())


def change_score(current: RegionView, previous: RegionView | None) -> float | None:
    """`1 - SSIM` area air terhadap frame saat AI terakhir dipanggil. None jika belum ada pembanding."""
    if previous is None:
        return None
    if current.gray.shape != previous.gray.shape:
        return 1.0  # resolusi atau kalibrasi berubah: anggap berubah total
    return round(1.0 - ssim(current.gray, previous.gray, current.mask & previous.mask), 4)


def change_threshold_for(base_threshold: float, recent_scores: list[float]) -> float:
    """Ambang perubahan untuk satu kamera: minimal ambang dasar, dan minimal dua kali variasi normalnya.

    Riak air dan bayangan membuat skor perubahan tiap kamera berbeda jauh (median 0,04 sampai 0,29
    pada uji 11 Okt 2026), jadi satu ambang untuk semua kamera akan memanggil AI hampir tiap siklus.
    """
    if len(recent_scores) < NOISE_MIN_SAMPLES:
        return float("inf")  # belum tahu variasi normalnya: andalkan heartbeat dulu
    return max(base_threshold, NOISE_FACTOR * float(np.median(recent_scores)))


def should_call_ai(
    *,
    now: datetime,
    last_call_at: datetime | None,
    change: float | None,
    rain_mm: float | None,
    change_threshold: float,
    heartbeat_minutes: int,
    rain_heartbeat_minutes: int,
    rain_trigger_mm: float,
) -> Trigger | None:
    """Pemicu pertama yang terpenuhi: perubahan visual, hujan, lalu heartbeat."""
    if last_call_at is None:
        return "heartbeat"
    elapsed = now - last_call_at
    if change is not None and change >= change_threshold:
        return "change"
    if rain_mm is not None and rain_mm > rain_trigger_mm and elapsed >= timedelta(minutes=rain_heartbeat_minutes):
        return "rain"
    if elapsed >= timedelta(minutes=heartbeat_minutes):
        return "heartbeat"
    return None


def annotated_crop(image: np.ndarray, cam: CameraRow) -> np.ndarray:
    """Potong ke area pengamatan dan gambar garis acuan berlabel N/W/S/A di atasnya."""
    height, width = image.shape[:2]
    x0, y0, x1, y1 = crop_box(region_points(cam), width, height)
    crop = image[y0:y1, x0:x1]
    # Selalu ke lebar yang sama: gambar besar diperkecil, kamera resolusi rendah diperbesar
    # supaya garis dan label tidak menutupi terlalu banyak detail.
    scale = VISION_MAX_WIDTH / crop.shape[1]
    interpolation = cv2.INTER_AREA if scale < 1 else cv2.INTER_CUBIC
    crop = cv2.resize(crop, (VISION_MAX_WIDTH, max(1, round(crop.shape[0] * scale))), interpolation=interpolation)
    scale_x, scale_y = crop.shape[1] / (x1 - x0), crop.shape[0] / (y1 - y0)

    lines = []
    for line in cam.reference_lines or []:
        label, color = LEVEL_STYLE[line["level"]]
        ends = [(round((px * width - x0) * scale_x), round((py * height - y0) * scale_y)) for px, py in line["points"]]
        lines.append((label, color, ends))

    # Garis semi-transparan: tepi air di bawahnya tetap terlihat.
    overlay = crop.copy()
    for _, color, (a, b) in lines:
        cv2.line(overlay, a, b, color, 2, cv2.LINE_AA)
    crop = cv2.addWeighted(overlay, LINE_OPACITY, crop, 1 - LINE_OPACITY, 0)

    # Label di ujung kanan tiap garis, digeser agar tidak bertumpuk saat garisnya berdekatan.
    previous_y = -LABEL_SPACING
    for label, color, ends in sorted(lines, key=lambda item: max(item[2])[1]):
        x, y = max(ends)
        y = min(max(y + 5, previous_y + LABEL_SPACING, 12), crop.shape[0] - 3)
        previous_y = y
        anchor = (min(max(x + 5, 2), crop.shape[1] - 14), y)
        cv2.putText(crop, label, anchor, cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 3, cv2.LINE_AA)
        cv2.putText(crop, label, anchor, cv2.FONT_HERSHEY_SIMPLEX, 0.45, color, 1, cv2.LINE_AA)
    return crop


def classify_with_ai(
    frame: np.ndarray,
    reference: np.ndarray | None,
    cam: CameraRow,
    quality: QualityResult,
    captured_at: datetime,
    *,
    api_key: str,
    model: str,
) -> tuple[VisionResult, dict]:
    """Minta AI menilai kondisi air. Selalu mengembalikan hasil; kegagalan menjadi `tidak_dapat_dinilai`."""
    content = [{"type": "input_text", "text": _camera_card(cam, quality, captured_at, has_reference=reference is not None)}]
    content.append({"type": "input_image", "image_url": _data_url(annotated_crop(frame, cam))})
    if reference is not None:
        content.append({"type": "input_image", "image_url": _data_url(annotated_crop(reference, cam))})
    schema = _schema()
    payload = {
        "model": model,
        "instructions": _system_prompt(),
        "reasoning": {"effort": "low"},
        "input": [{"role": "user", "content": content}],
        "text": {"format": {"type": "json_schema", "name": schema["name"], "strict": True, "schema": schema["schema"]}},
        "max_output_tokens": 700,
    }

    failure = "tidak diketahui"
    for _ in range(MAX_ATTEMPTS):
        try:
            response = httpx.post(
                RESPONSES_URL, headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=AI_TIMEOUT_SECONDS
            )
            response.raise_for_status()
            body = response.json()
            result = VisionResult.model_validate_json(_output_text(body))
            if not result.image_usable:
                result = result.model_copy(update={"status": "tidak_dapat_dinilai"})
            return result, {"output": result.model_dump(), "usage": body.get("usage"), "model": body.get("model")}
        except httpx.TimeoutException:
            failure = "timeout"
        except httpx.HTTPStatusError as exc:
            failure = f"HTTP {exc.response.status_code}"
            if exc.response.status_code in (400, 401, 403, 404):
                break  # permintaan salah atau kunci ditolak: mengulang tidak akan membantu
        except httpx.HTTPError as exc:
            failure = type(exc).__name__
        except (ValidationError, ValueError, KeyError) as exc:
            failure = f"output tidak valid ({type(exc).__name__})"
    log.warning("%s: penilaian AI gagal: %s", cam.name, failure)
    return VisionResult.failed(failure), {"error": failure}


def _camera_card(cam: CameraRow, quality: QualityResult, captured_at: datetime, *, has_reference: bool) -> str:
    local = captured_at.astimezone(WIB)
    period = "malam" if quality.is_night else "siang"
    infrared = ", mode inframerah" if quality.is_ir else ""
    return "\n".join(
        [
            f"Kamera: {cam.name}",
            f"Jenis lokasi: {cam.water_kind or '-'}",
            f"Sistem sungai: {cam.river_system or '-'}",
            f"Catatan kalibrasi: {cam.calibration_notes or '-'}",
            f"Waktu: {local:%d-%m-%Y %H.%M} WIB, {period}{infrared}",
            f"Kualitas gambar menurut sistem: {quality.quality}",
            "Gambar 1: kondisi saat ini." + (" Gambar 2: referensi kondisi normal." if has_reference else " Tidak ada gambar referensi."),
        ]
    )


def _data_url(image: np.ndarray) -> str:
    ok, buffer = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, VISION_JPEG_QUALITY])
    if not ok:
        raise ValueError("gagal meng-encode gambar untuk AI")
    return "data:image/jpeg;base64," + base64.b64encode(buffer.tobytes()).decode()


def _output_text(body: dict) -> str:
    parts = [
        part.get("text", "")
        for item in body.get("output", [])
        if item.get("type") == "message"
        for part in item.get("content") or []
        if part.get("type") == "output_text"
    ]
    if not parts:
        raise ValueError("respons AI tidak berisi teks")
    return "".join(parts)


@lru_cache(maxsize=1)
def _system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
