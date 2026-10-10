"""Hitung kendaraan dan orang per frame dengan YOLO lokal.

Hanya jumlah per kelas yang dipakai: tidak ada pelacakan, pengenalan wajah, atau pembacaan pelat.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

# Kelas COCO yang dihitung -> nama kolom di `traffic_readings`
COCO_CLASSES = {0: "persons", 1: "bicycles", 2: "cars", 3: "motorcycles", 5: "buses", 7: "trucks"}
MIN_IMAGE_SIZE = 640
MAX_IMAGE_SIZE = 1280
STRIDE = 32

_model: Any = None
_model_lock = threading.Lock()


@dataclass(frozen=True)
class Detection:
    class_id: int
    x1: float
    y1: float
    x2: float
    y2: float


@dataclass(frozen=True)
class Counts:
    persons: int = 0
    bicycles: int = 0
    cars: int = 0
    motorcycles: int = 0
    buses: int = 0
    trucks: int = 0

    @property
    def vehicle_total(self) -> int:
        return self.cars + self.motorcycles + self.buses + self.trucks


def detect(frame: np.ndarray, *, model_name: str, conf: float) -> list[Detection]:
    """Jalankan YOLO pada satu frame. Model dimuat sekali dan inferensi dijalankan bergantian."""
    global _model
    height, width = frame.shape[:2]
    with _model_lock:
        if _model is None:
            from ultralytics import YOLO  # impor berat, ditunda sampai benar-benar dipakai

            _model = YOLO(model_name)
        result = _model.predict(
            frame, imgsz=inference_size(width, height), conf=conf, classes=list(COCO_CLASSES), verbose=False
        )[0]
    boxes = result.boxes
    return [
        Detection(int(class_id), *(float(v) for v in xyxy))
        for class_id, xyxy in zip(boxes.cls.tolist(), boxes.xyxy.tolist(), strict=True)
    ]


def inference_size(width: int, height: int) -> int:
    """Ukuran inferensi mengikuti resolusi kamera, antara 640 dan 1280 px (kelipatan 32).

    Kamera resolusi tinggi dengan sudut lebar kehilangan banyak kendaraan kecil di 640 px;
    kamera resolusi rendah tidak mendapat apa-apa dari pembesaran.
    """
    longest = max(width, height)
    rounded = -(-longest // STRIDE) * STRIDE
    return max(MIN_IMAGE_SIZE, min(MAX_IMAGE_SIZE, rounded))


def count_detections(
    detections: list[Detection], frame_width: int, frame_height: int, roi: dict | None = None
) -> Counts:
    """Jumlahkan deteksi per kelas.

    Jika `roi` ada (`{"points": [[x, y], ...]}` ternormalisasi 0..1), hanya objek yang titik
    tengah-bawah kotaknya berada di dalam poligon yang dihitung.
    """
    polygon = _roi_polygon(roi, frame_width, frame_height)
    totals = dict.fromkeys(COCO_CLASSES.values(), 0)
    for det in detections:
        name = COCO_CLASSES.get(det.class_id)
        if name is None:
            continue
        if polygon is not None:
            foot = ((det.x1 + det.x2) / 2, det.y2)
            if cv2.pointPolygonTest(polygon, foot, False) < 0:
                continue
        totals[name] += 1
    return Counts(**totals)


def count_objects(frame: np.ndarray, roi: dict | None, *, model_name: str, conf: float) -> Counts:
    height, width = frame.shape[:2]
    return count_detections(detect(frame, model_name=model_name, conf=conf), width, height, roi)


def _roi_polygon(roi: dict | None, width: int, height: int) -> np.ndarray | None:
    points = (roi or {}).get("points") or []
    if len(points) < 3:
        return None
    return np.array([[x * width, y * height] for x, y in points], dtype=np.float32)
