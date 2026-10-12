"""Uji penilaian AI untuk satu kamera air pada frame arsip terakhirnya, tanpa menulis ke database.

Dipakai setelah mengkalibrasi atau mengubah prompt, untuk melihat apakah penilaiannya masuk akal
sebelum worker memakainya.

    python scripts/probe_camera.py "JRAKAH"            # 3 frame terakhir
    python scripts/probe_camera.py "Banger-SD-IN" 6 2  # 6 frame, selang 2 siklus

Gambar yang dikirim ke AI untuk frame terakhir disimpan sebagai `probe_crop.jpg` di sebelah
folder arsip frame. Setiap frame memakai satu panggilan AI (sekitar $0,0003).
Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import cv2  # noqa: E402
import numpy as np  # noqa: E402

from semarsight_worker import quality  # noqa: E402
from semarsight_worker.analyzers import water  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    name = sys.argv[1]
    count = int(sys.argv[2]) if len(sys.argv) > 2 else 3
    step = int(sys.argv[3]) if len(sys.argv) > 3 else 1

    settings = get_settings()
    database = Database(settings, dry_run=True)
    camera = next((c for c in database.active_cameras() if c.name == name), None)
    if camera is None:
        raise SystemExit(f"Kamera '{name}' tidak ditemukan di antara kamera aktif.")
    print(
        f"unggulan={camera.is_featured} terkalibrasi={camera.is_calibrated} jenis={camera.water_kind} "
        f"garis={len(camera.reference_lines or [])} referensi siang={bool(camera.reference_image_day)} malam={bool(camera.reference_image_night)}"
    )
    if not camera.is_calibrated:
        raise SystemExit("Kamera ini belum dikalibrasi (area pengamatan belum ditandai).")

    def load(path: str | None) -> np.ndarray | None:
        if not path:
            return None
        return cv2.imdecode(np.frombuffer(database.download_object(path), dtype=np.uint8), cv2.IMREAD_COLOR)

    # Sama seperti worker: referensi sesuai waktu, dengan cadangan referensi yang satunya.
    references = {
        False: load(camera.reference_image_day or camera.reference_image_night),
        True: load(camera.reference_image_night or camera.reference_image_day),
    }
    frames = sorted((settings.frames_dir / camera.id).glob("*/*.jpg"))[::-1][: count * step : step][::-1]
    if not frames:
        raise SystemExit(f"Belum ada frame arsip untuk kamera ini di {settings.frames_dir}.")

    for path in frames:
        frame = cv2.imread(str(path))
        taken = datetime.strptime(path.parent.name + path.stem, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc)
        assessed = quality.assess(frame, taken)
        cv2.imwrite(str(settings.frames_dir.parent / "probe_crop.jpg"), water.annotated_crop(frame, camera))
        result, _ = water.classify_twice_if_raised(
            frame,
            references[assessed.is_night],
            camera,
            assessed,
            taken,
            api_key=settings.openai_api_key,
            model=settings.openai_vision_model,
        )
        print(
            f"{path.parent.name} {path.stem} UTC malam={assessed.is_night!s:<5} status={result.status:<20} jalan={result.road_flood:<16} "
            f"yakin={result.confidence:.2f} vs_referensi={result.change_vs_reference:<22} | {result.reason[:120]}"
        )


if __name__ == "__main__":
    main()
