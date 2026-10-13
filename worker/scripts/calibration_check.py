"""Periksa kalibrasi semua kamera air: yang perlu ditindaklanjuti ditulis lebih dulu. Hanya membaca.

Dijalankan di awal tiap sesi kerja dan setiap kali ada penilaian yang bukan normal.

    python scripts/calibration_check.py        # penilaian 24 jam terakhir
    python scripts/calibration_check.py 48     # 48 jam terakhir

Yang diperiksa per kamera: urutan dan jarak garis acuan, foto referensi siang dan malam, keyakinan AI
siang dan malam, penilaian yang bukan normal, dan penilaian sampah yang tidak ajek. Penilaian bukan normal harus dilihat gambarnya
(`python scripts/replay_readings.py "<nama>" --odd`) sebelum dianggap kejadian.
Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import sys
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import PAGE_SIZE, Database  # noqa: E402
from semarsight_worker.fusion import smoothing  # noqa: E402

LEVELS = ["normal", "waspada", "siaga", "awas"]
MIN_LINE_GAP = 0.012  # jarak tegak antar garis, dalam porsi tinggi gambar; di bawah ini garis sulit dibedakan AI
LOW_NIGHT_CONFIDENCE = 0.6
TRASH_FLIPS_TO_FLAG = 6


def main() -> None:
    hours = int(sys.argv[1]) if len(sys.argv) > 1 else 24
    database = Database(get_settings(), dry_run=True)
    cameras = [c for c in database.active_cameras() if c.is_calibrated]
    since = (datetime.now(timezone.utc) - timedelta(hours=hours)).isoformat()
    readings: dict[str, list[dict]] = defaultdict(list)
    offset = 0
    while True:
        page = (
            database._client.table("water_readings").select("camera_id, status, confidence, is_night, trash")
            .gte("captured_at", since).order("captured_at").range(offset, offset + PAGE_SIZE - 1).execute().data
        )
        for row in page:
            readings[row["camera_id"]].append(row)
        offset += PAGE_SIZE
        if len(page) < PAGE_SIZE:
            break

    fine, attention = [], []
    for cam in sorted(cameras, key=lambda c: c.name):
        rows = readings.get(cam.id, [])
        issues = []
        heights = {line["level"]: sum(point[1] for point in line["points"]) / 2 for line in cam.reference_lines or []}
        ordered = [heights[level] for level in LEVELS if level in heights]
        gaps = [lower - upper for lower, upper in zip(ordered, ordered[1:])]
        if any(gap <= 0 for gap in gaps):
            issues.append("URUTAN GARIS TERTUKAR")
        elif gaps and min(gaps) < MIN_LINE_GAP:
            issues.append("garis terlalu rapat")
        if not cam.reference_image_day:
            issues.append("belum ada referensi siang")
        if not cam.reference_image_night:
            issues.append("belum ada referensi malam")
        if not cam.is_featured:
            issues.append("bukan unggulan (belum dinilai AI)")

        def mean(night: bool) -> float | None:
            values = [r["confidence"] for r in rows if bool(r["is_night"]) == night and r["confidence"] is not None]
            return sum(values) / len(values) if values else None

        day, night = mean(False), mean(True)
        if night is not None and night < LOW_NIGHT_CONFIDENCE:
            issues.append(f"keyakinan malam rendah ({night:.2f})")
        odd = Counter(r["status"] for r in rows if r["status"] != "normal")
        if odd:
            counted = sum(r["status"] in LEVELS and (r["confidence"] or 0) >= smoothing.MIN_CONFIDENCE_ELEVATED for r in rows if r["status"] != "normal")
            issues.append("penilaian bukan normal: " + ", ".join(f"{n}x {s}" for s, n in odd.items()) + f" ({counted} cukup yakin untuk dihitung)")

        # Penilaian sampah yang sering berganti antara "banyak" dan tingkat lain: AI tidak ajek di lokasi ini.
        # Status resminya sudah dihaluskan, tetapi gambarnya perlu dilihat sebelum sampahnya dijadikan temuan.
        trash = [r["trash"] for r in rows if r.get("trash") in smoothing.TRASH_LEVELS]
        heavy_flips = sum((a == smoothing.TRASH_HEAVY) != (b == smoothing.TRASH_HEAVY) for a, b in zip(trash, trash[1:]))
        if heavy_flips >= TRASH_FLIPS_TO_FLAG:
            issues.append(f"penilaian sampah tidak ajek: 'banyak' berganti {heavy_flips}x dalam {len(trash)} penilaian")

        confidence = f"yakin siang {day:.2f}" if day is not None else "yakin siang -"
        confidence += f", malam {night:.2f}" if night is not None else ", malam -"
        line = f"{cam.name:22} {str(cam.water_kind):10} {len(rows):3} penilaian, {confidence}"
        (attention if issues else fine).append(line + ("\n      -> " + "; ".join(issues) if issues else ""))

    print(f"Kalibrasi {len(cameras)} kamera air, penilaian {hours} jam terakhir.\n")
    print(f"PERLU DILIHAT ({len(attention)}):")
    print("\n".join("  " + line for line in attention) or "  tidak ada")
    print(f"\nBAIK ({len(fine)}):")
    print("\n".join("  " + line for line in fine) or "  tidak ada")


if __name__ == "__main__":
    main()
