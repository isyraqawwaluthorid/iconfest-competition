"""Gambar kotak deteksi YOLO di atas snapshot terbaru beberapa kamera lalu lintas, untuk memeriksa hitungan dengan mata.

Dipakai untuk evaluasi hitungan kendaraan: buka tiap gambar hasil, hitung kendaraan yang terlihat tetapi tidak
berkotak (terlewat) dan kotak yang salah (bukan kendaraan, atau jenisnya keliru). Hanya membaca; tidak menulis ke database.

    python scripts/annotate_counts.py <folder_keluaran> [jumlah_kamera]

Kamera dipilih merata dari yang sedang ramai sampai yang sepi, supaya contohnya tidak hanya dari satu keadaan.
Warna kotak: mobil biru, sepeda motor hijau, bus jingga, truk merah, orang abu-abu. Garis kuning = area hitung.
Yang dihitung sistem hanya objek yang titik tengah-bawah kotaknya berada di dalam area hitung (kotak tebal).
Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import sys
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from semarsight_worker.analyzers import traffic  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402

WIB = ZoneInfo("Asia/Jakarta")
COLORS = {"cars": (220, 120, 0), "motorcycles": (0, 170, 0), "buses": (0, 140, 255), "trucks": (0, 0, 230), "persons": (150, 150, 150), "bicycles": (200, 0, 200)}
LETTER = {"cars": "M", "motorcycles": "S", "buses": "B", "trucks": "T", "persons": "o", "bicycles": "sp"}
MIN_VEHICLES = 4  # kamera yang hampir kosong tidak memberi bahan untuk diperiksa


def main() -> None:
    out = Path(sys.argv[1])
    wanted = int(sys.argv[2]) if len(sys.argv) > 2 else 10
    out.mkdir(parents=True, exist_ok=True)
    settings = get_settings()
    database = Database(settings, dry_run=True)
    cameras = {cam.id: cam for cam in database.active_cameras() if "traffic" in cam.modules}
    rows = database._client.table("camera_status").select("camera_id, health, vehicle_count, latest_snapshot_at").execute().data
    live = sorted(
        (row for row in rows if row["camera_id"] in cameras and row["health"] == "live" and (row["vehicle_count"] or 0) >= MIN_VEHICLES),
        key=lambda row: -row["vehicle_count"],
    )
    step = max(1, len(live) // wanted)
    picked = live[::step][:wanted]
    print(f"{len(live)} kamera lalu lintas hidup dengan >= {MIN_VEHICLES} kendaraan; diperiksa {len(picked)}")

    for row in picked:
        cam = cameras[row["camera_id"]]
        data = database.download_object(f"latest/{cam.id}.jpg")
        frame = cv2.imdecode(np.frombuffer(data, dtype=np.uint8), cv2.IMREAD_COLOR)
        height, width = frame.shape[:2]
        detections = traffic.detect(frame, model_name=settings.yolo_model, conf=settings.yolo_conf)
        polygon = traffic._roi_polygon(cam.traffic_roi, width, height)
        counts = traffic.count_detections(detections, width, height, cam.traffic_roi)
        if polygon is not None:
            cv2.polylines(frame, [polygon.astype(np.int32)], True, (0, 220, 255), 2)
        for det in detections:
            name = traffic.COCO_CLASSES[det.class_id]
            foot = ((det.x1 + det.x2) / 2, det.y2)
            counted = polygon is None or cv2.pointPolygonTest(polygon, foot, False) >= 0
            p1, p2 = (int(det.x1), int(det.y1)), (int(det.x2), int(det.y2))
            cv2.rectangle(frame, p1, p2, COLORS[name], 2 if counted else 1)
            cv2.putText(frame, LETTER[name], (p1[0], max(10, p1[1] - 3)), cv2.FONT_HERSHEY_SIMPLEX, 0.45, COLORS[name], 1, cv2.LINE_AA)
        taken = datetime.fromisoformat(row["latest_snapshot_at"]).astimezone(WIB)
        label = f"{cam.name} {taken:%H.%M}  M={counts.cars} S={counts.motorcycles} B={counts.buses} T={counts.trucks}"
        cv2.putText(frame, label, (8, height - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 0), 4, cv2.LINE_AA)
        cv2.putText(frame, label, (8, height - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
        target = out / f"{cam.name.replace(' ', '_').replace('.', '').replace('/', '-')}.jpg"
        cv2.imwrite(str(target), frame)
        print(f"  {cam.name[:30]:30} {taken:%H.%M} {width}x{height} mobil={counts.cars} motor={counts.motorcycles} bus={counts.buses} truk={counts.trucks} -> {target.name}")


if __name__ == "__main__":
    main()
