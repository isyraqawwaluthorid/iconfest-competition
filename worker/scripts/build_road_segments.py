"""Bangun ruas jalan di sekitar tiap kamera lalu lintas dari OpenStreetMap, untuk halaman Lalu Lintas.

Hasilnya dua berkas di `web/lib/geo/`: `road-segments.json` (per kamera: ruas dekat yang kira-kira
terlihat, dan perpanjangannya di jalan yang sama) yang diwarnai web menurut tingkat kepadatan kamera itu,
dan `road-network.json` (semua jalan utama beserta kamera terdekatnya; jalan tanpa kamera diwarnai web
sebagai perkiraan dari kamera terdekat). Dijalankan sekali, dan
diulang bila daftar kamera lalu lintas berubah. Hanya membaca database; yang ditulis hanya dua berkas itu.

    python scripts/build_road_segments.py                 # ambil dari Overpass, tulis JSON
    python scripts/build_road_segments.py --cache raw.json  # simpan/pakai ulang jawaban Overpass

Kamera yang jalannya lebih jauh dari 60 m ditandai `needs_review`; periksa di peta sebelum dipakai.
Data jalan © kontributor OpenStreetMap (ODbL). Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from semarsight_worker import roads  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402

OVERPASS_URLS = ("https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter")
SEARCH_M = 1250  # cukup untuk menyusuri EXTENDED_M ke tiap arah dari jalan sejauh FALLBACK_M
HIGHWAYS = "motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street"
GEO_DIR = Path(__file__).resolve().parents[2] / "web" / "lib" / "geo"
OUTPUT = GEO_DIR / "road-segments.json"
NETWORK_OUTPUT = GEO_DIR / "road-network.json"
SOURCE = "OpenStreetMap (Overpass API), © kontributor OpenStreetMap, ODbL"


def _rounded(lines, digits: int) -> list[list[list[float]]]:
    return [[[round(lat, digits), round(lng, digits)] for lat, lng in line] for line in lines]


def fetch_ways(cameras: list[dict]) -> list[dict]:
    # Satu kotak yang memuat semua kamera: jauh lebih ringan bagi Overpass daripada satu lingkaran per kamera.
    margin = SEARCH_M / 111_000 * 1.2
    south, north = min(c["lat"] for c in cameras) - margin, max(c["lat"] for c in cameras) + margin
    west, east = min(c["lng"] for c in cameras) - margin, max(c["lng"] for c in cameras) + margin
    query = (
        f"[out:json][timeout:180][bbox:{south:.5f},{west:.5f},{north:.5f},{east:.5f}];"
        f'way[highway~"^({HIGHWAYS})(_link)?$"];out body geom;'
    )
    error: Exception | None = None
    for url in OVERPASS_URLS:
        try:
            response = httpx.post(url, data={"data": query}, timeout=240.0, headers={"User-Agent": "SemarSight/1.0"})
            response.raise_for_status()
            return response.json()["elements"]
        except (httpx.HTTPError, ValueError, KeyError) as exc:
            print(f"Overpass gagal di {url}: {exc}")
            error = exc
    raise SystemExit(f"Tidak bisa mengambil data jalan: {error}")


def main() -> None:
    cache = Path(sys.argv[sys.argv.index("--cache") + 1]) if "--cache" in sys.argv else None
    database = Database(get_settings(), dry_run=True)
    rows = database._client.table("cameras").select("id, name, lat, lng, modules").eq("is_active", True).execute().data
    cameras = sorted((row for row in rows if "traffic" in (row["modules"] or [])), key=lambda row: row["name"])

    if cache and cache.exists():
        elements = json.loads(cache.read_text(encoding="utf-8"))
    else:
        elements = fetch_ways(cameras)
        if cache:
            cache.write_text(json.dumps(elements), encoding="utf-8")
    ways = roads.ways_from_overpass(elements)
    print(f"{len(cameras)} kamera lalu lintas, {len(ways)} garis jalan dari OpenStreetMap")

    # Lintasan pertama: jalan tiap kamera. Kamera lain di jalan yang sama memendekkan ruas supaya tidak bertumpuk.
    points = {camera["id"]: (camera["lat"], camera["lng"]) for camera in cameras}
    nearby_ways = {cid: [way for way in ways if roads.nearest_on_way(way, point)[0] <= SEARCH_M] for cid, point in points.items()}
    hints = {camera["id"]: roads.name_hints(camera["name"]) for camera in cameras}
    picked = {cid: roads.pick_way(nearby_ways[cid], point, hints[cid]) for cid, point in points.items()}
    road_keys = {cid: pick[0].key for cid, pick in picked.items() if pick and pick[0].key}

    segments, missing = [], []
    for camera in cameras:
        cid, point = camera["id"], points[camera["id"]]
        neighbours = [points[other] for other, key in road_keys.items() if other != cid and key == road_keys.get(cid)]
        segment = roads.segment_for(point, nearby_ways[cid], hints[cid], roads.shared_reach(point, neighbours))
        if segment is None:
            missing.append(camera["name"])
            continue
        # Perpanjangan di jalan yang sama: perkiraan dari kamera ini, juga berhenti di tengah jarak ke kamera tetangga.
        far = roads.segment_for(point, nearby_ways[cid], hints[cid], roads.shared_reach(point, neighbours, roads.EXTENDED_M))
        flag = "  PERIKSA" if segment.needs_review else ""
        print(
            f"  {camera['name'][:34]:34} -> {segment.road_name or '(tanpa nama)':32} {segment.road_class:11}"
            f" {segment.distance_m:5.0f} m  {len(segment.lines)} garis{flag}"
        )
        segments.append(
            {
                "camera_id": camera["id"],
                "road_name": segment.road_name,
                "road_class": segment.road_class,
                "distance_m": segment.distance_m,
                "length_m": segment.length_m,
                "needs_review": segment.needs_review,
                "lines": _rounded(segment.lines, 6),
                "extended": _rounded(far.lines if far else segment.lines, 5),
            }
        )
    if missing:
        print("Tanpa jalan dalam jangkauan:", ", ".join(missing))

    OUTPUT.write_text(
        json.dumps(
            {
                "generated_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                "source": SOURCE,
                "reach_m": roads.REACH_M,
                "extended_m": roads.EXTENDED_M,
                "segments": segments,
            },
            ensure_ascii=False,
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    print(f"{len(segments)} ruas ditulis ke {OUTPUT}")

    lines = roads.network_lines(ways)
    camera_points = [points[camera["id"]] for camera in cameras]
    NETWORK_OUTPUT.write_text(
        json.dumps(
            {
                "source": SOURCE,
                "cameras": [camera["id"] for camera in cameras],
                "lines": _rounded(lines, 5),
                # Per garis: [indeks kamera, jarak m, ...] untuk beberapa kamera terdekat, yang terdekat lebih dulu.
                "near": [[value for pair in roads.nearest_cameras(line, camera_points) for value in pair] for line in lines],
            },
            separators=(",", ":"),
        ),
        encoding="utf-8",
    )
    network = lines
    print(f"{len(network)} garis jalan utama ditulis ke {NETWORK_OUTPUT} ({NETWORK_OUTPUT.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
