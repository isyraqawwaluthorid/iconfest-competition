"""Nilai ulang gambar bukti yang tersimpan dengan kalibrasi dan prompt saat ini, tanpa menulis ke database.

Dipakai setelah mengubah garis acuan, foto referensi, catatan kalibrasi, atau prompt: penilaian lama
dibandingkan dengan penilaian baru atas gambar yang sama, sehingga terlihat apakah salah baca yang
pernah terjadi sudah hilang dan apakah lokasi lain ikut berubah.

    python scripts/replay_readings.py "Kartini-OUT"          # 6 gambar bukti terakhir
    python scripts/replay_readings.py "Kartini-OUT" 12       # 12 terakhir
    python scripts/replay_readings.py "Kartini-OUT" --odd    # hanya yang dulu dinilai bukan normal
    python scripts/replay_readings.py --all 3                # semua lokasi: 3 terakhir + semua yang bukan normal

Gambar bukti disimpan 3 hari di Storage dengan lebar 960 px, jadi potongannya sedikit lebih kasar
daripada yang dinilai worker dari frame asli. Satu gambar memakai satu panggilan AI (sekitar $0,0003).
Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from semarsight_worker import quality  # noqa: E402
from semarsight_worker.analyzers import water  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402
from semarsight_worker.fusion import smoothing  # noqa: E402

WIB = ZoneInfo("Asia/Jakarta")
COLUMNS = "captured_at, status, road_flood, confidence, snapshot_path, trash"


def main() -> None:
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {a for a in sys.argv[1:] if a.startswith("--")}
    count = next((int(a) for a in args if a.isdigit()), 6)
    names = [a for a in args if not a.isdigit()]
    if not names and "--all" not in flags:
        raise SystemExit(__doc__)

    settings = get_settings()
    database = Database(settings, dry_run=True)
    cameras = [c for c in database.active_cameras() if c.is_calibrated and (c.name in names or ("--all" in flags and c.is_featured))]
    if not cameras:
        raise SystemExit("Tidak ada kamera terkalibrasi yang cocok.")

    def load(path: str | None) -> np.ndarray | None:
        if not path:
            return None
        return cv2.imdecode(np.frombuffer(database.download_object(path), dtype=np.uint8), cv2.IMREAD_COLOR)

    def evidence(cam, *, odd_only: bool, limit: int) -> list[dict]:
        query = database._client.table("water_readings").select(COLUMNS).eq("camera_id", cam.id).like("snapshot_path", "readings/%")
        if odd_only:
            query = query.neq("status", "normal")
        return query.order("captured_at", desc=True).limit(limit).execute().data

    jobs = []
    for cam in sorted(cameras, key=lambda c: c.name):
        rows = {} if "--odd" in flags else {r["snapshot_path"]: r for r in evidence(cam, odd_only=False, limit=count)}
        if "--odd" in flags or "--all" in flags:
            rows |= {r["snapshot_path"]: r for r in evidence(cam, odd_only=True, limit=50)}
        # Sama seperti worker: referensi sesuai waktu, dengan cadangan referensi yang satunya.
        references = {
            False: load(cam.reference_image_day or cam.reference_image_night),
            True: load(cam.reference_image_night or cam.reference_image_day),
        }
        jobs += [(cam, references, row) for row in sorted(rows.values(), key=lambda r: r["captured_at"])]

    def assess(job):
        cam, references, row = job
        taken = datetime.fromisoformat(row["captured_at"])
        frame = load(row["snapshot_path"])
        assessed = quality.assess(frame, taken)
        result, _ = water.classify_twice_if_raised(
            frame, references[assessed.is_night], cam, assessed, taken, api_key=settings.openai_api_key, model=settings.openai_vision_model
        )
        return cam, row, assessed, result

    def level(cam, status: str, road_flood: str, confidence: float, vs_reference: str | None = None) -> str:
        """Level yang dihitung penghalusan dari pembacaan ini: nama level, atau '-' jika tidak dipakai."""
        value = smoothing.level_of(smoothing.Reading(status, road_flood, confidence, None, vs_reference), cam.water_kind)
        return "-" if value is None else smoothing.LEVELS[value]

    before, after = Counter(), Counter()
    trash_before, trash_after = Counter(), Counter()
    with ThreadPoolExecutor(max_workers=6) as pool:
        for cam, row, assessed, result in pool.map(assess, jobs):
            old = level(cam, row["status"], row["road_flood"], row["confidence"] or 0.0)
            new = level(cam, result.status, result.road_flood, result.confidence, result.change_vs_reference)
            before[old] += 1
            after[new] += 1
            trash_before[row.get("trash")] += 1
            trash_after[result.trash] += 1
            at = datetime.fromisoformat(row["captured_at"]).astimezone(WIB)
            print(
                f"{cam.name[:22]:22} {at:%d/%m %H.%M} {'malam' if assessed.is_night else 'siang'} "
                f"dulu {row['status']:19} {row['confidence'] or 0:.2f} -> kini {result.status:19} {result.confidence:.2f} "
                f"dipakai={new:8} vs_ref={result.change_vs_reference:22} sampah {str(row.get('trash'))[:7]:7}->{result.trash[:7]:7} | {result.reason[:90]}"
            )
    print(f"\n{len(jobs)} gambar. Level yang dipakai penghalusan ('-' = diabaikan, menandai perlu diperiksa):")
    print("  dulu:", dict(before))
    print("  kini:", dict(after))
    print("Penilaian sampah (mentah, sebelum dihaluskan):")
    print("  dulu:", dict(trash_before))
    print("  kini:", dict(trash_after))


if __name__ == "__main__":
    main()
