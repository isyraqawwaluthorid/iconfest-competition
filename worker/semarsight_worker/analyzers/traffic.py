"""Hitung kendaraan dan orang per frame dengan YOLO lokal.

Hanya jumlah per kelas yang dipakai: tidak ada pelacakan, pengenalan wajah, atau pembacaan pelat.
"Orang" berarti pejalan kaki: orang yang terdeteksi sedang menaiki sepeda motor atau sepeda tidak dihitung,
supaya keramaian ruang publik tidak tercampur lalu lintas.
"""

from __future__ import annotations

import threading
from dataclasses import dataclass
from typing import Any

import cv2
import numpy as np

# Kelas COCO yang dihitung -> nama kolom di `traffic_readings`
COCO_CLASSES = {0: "persons", 1: "bicycles", 2: "cars", 3: "motorcycles", 5: "buses", 7: "trucks"}
PERSON, RIDDEN = 0, (1, 3)  # orang; sepeda dan sepeda motor
MAX_RIDERS = 2  # pengendara dan satu pembonceng per kendaraan
RIDER_OVERLAP = 0.2  # porsi kotak orang yang menumpuk kotak kendaraannya
# Versi aturan hitung. Dinaikkan bila arti sebuah kolom berubah (versi 2: `persons` tanpa pengendara), supaya
# pembanding tidak mencampur hitungan dari aturan yang berbeda.
COUNT_RULES = 2
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


def method_tag(model_name: str) -> str:
    """Penanda cara hitung yang disimpan di `traffic_readings.model`: model deteksi dan versi aturan hitungnya."""
    return f"{model_name}/r{COUNT_RULES}"


def riders(detections: list[Detection]) -> set[int]:
    """Indeks deteksi orang yang sedang menaiki sepeda motor atau sepeda.

    Seorang pengendara: titik tengah-bawah kotaknya berada di dalam kotak kendaraan dan kotaknya cukup
    menumpuk kotak itu. Paling banyak dua orang per kendaraan. Orang yang berdiri tepat di belakang motor
    yang diparkir bisa ikut terbuang; itu diterima, karena yang dicari adalah pejalan kaki yang jelas.
    """
    found: set[int] = set()
    for vehicle in (d for d in detections if d.class_id in RIDDEN):
        candidates = []
        for index, person in enumerate(detections):
            if person.class_id != PERSON or index in found:
                continue
            foot_x = (person.x1 + person.x2) / 2
            if not (vehicle.x1 <= foot_x <= vehicle.x2 and vehicle.y1 <= person.y2 <= vehicle.y2):
                continue
            overlap_w = min(person.x2, vehicle.x2) - max(person.x1, vehicle.x1)
            overlap_h = min(person.y2, vehicle.y2) - max(person.y1, vehicle.y1)
            area = max(1e-6, (person.x2 - person.x1) * (person.y2 - person.y1))
            share = max(0.0, overlap_w) * max(0.0, overlap_h) / area
            if share >= RIDER_OVERLAP:
                candidates.append((share, index))
        found.update(index for _, index in sorted(candidates, reverse=True)[:MAX_RIDERS])
    return found


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
    """Jumlahkan deteksi per kelas. Orang yang sedang menaiki sepeda motor atau sepeda tidak dihitung sebagai orang.

    Jika `roi` ada (`{"points": [[x, y], ...]}` ternormalisasi 0..1), hanya objek yang titik
    tengah-bawah kotaknya berada di dalam poligon yang dihitung.
    """
    polygon = _roi_polygon(roi, frame_width, frame_height)
    totals = dict.fromkeys(COCO_CLASSES.values(), 0)
    riding = riders(detections)
    for index, det in enumerate(detections):
        name = COCO_CLASSES.get(det.class_id)
        if name is None or index in riding:
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
