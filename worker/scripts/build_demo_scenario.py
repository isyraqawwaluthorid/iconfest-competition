"""Susun skenario simulasi kejadian air naik untuk halaman `/simulasi`, tanpa menulis ke database.

Belum pernah ada kejadian air naik yang nyata, jadi tidak ada yang bisa diputar ulang. Skenario ini
memakai MASUKAN BUATAN (penilaian AI per kamera dan prakiraan hujan, ditulis di bawah), lalu
menjalankannya melalui ATURAN YANG ASLI: penghalusan status, tren, skor risiko, hubungan hulu-hilir,
peringatan, dan insight dari LLM teks. Hasil tiap langkah disimpan ke `web/lib/demo/scenario.json`.

    python scripts/build_demo_scenario.py            # susun ulang (±6 panggilan LLM teks, sekitar $0,01)
    python scripts/build_demo_scenario.py --no-llm   # periksa jalannya aturan saja, tanpa menulis berkas
    python scripts/build_demo_scenario.py --keep-insights   # hitung ulang aturannya, pakai lagi insight yang sudah ada

Jalankan ulang setelah mengubah aturan, prompt insight, atau hubungan hulu-hilir, supaya simulasi tetap
mencerminkan sistem yang sebenarnya. Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from semarsight_worker import alerts, insights  # noqa: E402
from semarsight_worker.config import REPO_ROOT, get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402
from semarsight_worker.fusion import risk, smoothing, trend, upstream  # noqa: E402
from semarsight_worker.sources.openmeteo import GridWeather  # noqa: E402

WIB = ZoneInfo("Asia/Jakarta")
OUTPUT = REPO_ROOT / "web" / "lib" / "demo" / "scenario.json"
START_HOUR_WIB = 16  # jam mulai pada jam simulasi; tanggalnya hari skenario disusun

UPSTREAM_SITE, DOWNSTREAM_SITE, ROAD_SITE = "Progo-IN", "Progo-OUT", "JRAKAH"

# Prakiraan hujan buatan untuk wilayah lokasi di atas: (kini, 1 jam, 3 jam, 6 jam, peluang %).
DRY = (0.0, 0.1, 0.4, 0.6, 35)
RAIN = {0: DRY, 15: (0.4, 3.2, 12.5, 16.0, 80), 30: (5.8, 8.5, 18.5, 24.0, 90), 40: (6.2, 9.4, 21.5, 27.0, 95), 75: (2.0, 3.0, 6.5, 8.0, 60), 95: (0.2, 0.3, 0.8, 1.0, 30)}

# Penilaian AI buatan: (menit, lokasi, status, genangan jalan, keyakinan).
READINGS = [
    (30, UPSTREAM_SITE, "waspada", "tidak_relevan", 0.74),
    (40, UPSTREAM_SITE, "waspada", "tidak_relevan", 0.79),
    (50, UPSTREAM_SITE, "siaga", "tidak_relevan", 0.78),
    (50, ROAD_SITE, "waspada", "genangan_ringan", 0.72),
    (60, UPSTREAM_SITE, "siaga", "tidak_relevan", 0.82),
    (60, ROAD_SITE, "waspada", "genangan_ringan", 0.8),
    (60, DOWNSTREAM_SITE, "waspada", "tidak_relevan", 0.7),
    (75, UPSTREAM_SITE, "siaga", "tidak_relevan", 0.8),
    (75, ROAD_SITE, "waspada", "genangan_ringan", 0.77),
    (75, DOWNSTREAM_SITE, "waspada", "tidak_relevan", 0.76),
    *[(minute, site, "normal", "tidak_tergenang" if site == ROAD_SITE else "tidak_relevan", 0.84)
      for minute in (95, 105, 115) for site in (UPSTREAM_SITE, DOWNSTREAM_SITE, ROAD_SITE)],
]  # fmt: skip

# Alasan yang menyertai tiap penilaian buatan, meniru kalimat alasan AI kamera.
REASONS = {
    "normal": "Permukaan air kembali di bawah garis N, setinggi gambar referensi.",
    "waspada": "Permukaan air tampak sedikit di atas garis N, lebih tinggi daripada gambar referensi.",
    "siaga": "Permukaan air tampak mencapai garis S pada dinding, jelas lebih tinggi daripada gambar referensi.",
    "genangan_ringan": "Lapisan air terlihat menggenang di sebagian lajur; roda kendaraan memercikkan air.",
    "tidak_tergenang": "Badan jalan tampak kering, tidak ada air yang menggenang.",
}

# Langkah yang ditampilkan: (menit, keterangan untuk penonton, status terkonfirmasi yang diharapkan).
STEPS = [
    (0, "Keadaan awal: semua lokasi air normal dan hujan belum diprakirakan.", {UPSTREAM_SITE: "normal"}),
    (15, "Prakiraan hujan 3 jam ke depan naik menjadi 12,5 mm. Aturan membuka peringatan hujan lebat; di kamera belum ada yang berubah.", {UPSTREAM_SITE: "normal"}),
    (30, "AI kamera menilai Progo-IN \"waspada\" untuk pertama kali. Ini baru indikasi awal: status resminya tetap Normal sampai penilaian kedua sepakat.", {UPSTREAM_SITE: "normal"}),
    (40, "Penilaian kedua sepakat, jadi status resmi Progo-IN naik menjadi Waspada. Peringatan dini otomatis dibuat untuk Progo-OUT di hilirnya, dan ringkasan AI ditulis ulang.", {UPSTREAM_SITE: "waspada", DOWNSTREAM_SITE: "normal"}),
    (50, "AI kamera menilai Progo-IN \"siaga\" dan jalan JRAKAH tergenang ringan, masing-masing baru sekali. Keduanya masih indikasi awal: status resmi belum berubah.", {UPSTREAM_SITE: "waspada", ROAD_SITE: "normal"}),
    (60, "Keduanya terkonfirmasi: Progo-IN siaga dan JRAKAH waspada karena genangan ringan. Tingkat keseluruhan naik menjadi siaga.", {UPSTREAM_SITE: "siaga", ROAD_SITE: "waspada", DOWNSTREAM_SITE: "normal"}),
    (75, "Progo-OUT di hilir ikut waspada setelah dua penilaian, sementara hujan mulai reda.", {UPSTREAM_SITE: "siaga", DOWNSTREAM_SITE: "waspada"}),
    (115, "Setelah tiga penilaian normal berturut-turut, semua lokasi kembali normal dan peringatannya ditutup otomatis.", {UPSTREAM_SITE: "normal", DOWNSTREAM_SITE: "normal", ROAD_SITE: "normal"}),
]  # fmt: skip


def main() -> None:
    use_llm = "--no-llm" not in sys.argv
    settings = get_settings()
    database = Database(settings, dry_run=True)
    cameras = database.active_cameras()
    by_name = {cam.name: cam for cam in cameras}
    links = upstream.links_from_rows(database.river_links())
    grid = {point.id: point for point in database.weather_grid()}
    live = database.insight_inputs()
    today = datetime.now(WIB)
    start = datetime(today.year, today.month, today.day, START_HOUR_WIB, tzinfo=WIB).astimezone(timezone.utc)

    # Keadaan awal dibuat tenang untuk semua lokasi air, supaya skenario tidak bergantung pada keadaan saat disusun.
    sites = [cam for cam in cameras if "water" in cam.modules and cam.is_calibrated and live.get(cam.id, {}).get("water_status")]
    statuses = {camera_id: dict(row) for camera_id, row in live.items()}
    readings: dict[str, list[smoothing.Reading]] = {}
    levels: dict[str, list[tuple[datetime, int]]] = {}
    for cam in sites:
        road = "tidak_tergenang" if cam.water_kind == "jalan" else "tidak_relevan"
        statuses[cam.id] |= {
            "health": "live", "consecutive_failures": 0, "water_status": "normal", "water_trend": "stabil",
            "water_status_since": (start - timedelta(days=1)).isoformat(), "road_flood": road,
            "trash": "tidak_relevan" if cam.water_kind == "jalan" else "tidak_terlihat",
            "water_confidence": 0.84, "needs_verification": False,
        }  # fmt: skip
        calm = smoothing.Reading("normal", road, 0.84, "good", "sama")
        readings[cam.id] = [calm, calm, calm]
        levels[cam.id] = [(start - timedelta(minutes=minutes), 0) for minutes in (30, 60, 90)]
    wet_grids = {by_name[name].weather_grid_id for name in (UPSTREAM_SITE, DOWNSTREAM_SITE, ROAD_SITE)}

    history: list[dict] = []  # semua penilaian AI buatan sejauh ini, urut waktu
    # Tiga penilaian tenang sebelum skenario dimulai, supaya riwayat tiap lokasi tidak tiba-tiba mulai dari "waspada".
    for minutes in (90, 60, 30):
        for name in (UPSTREAM_SITE, DOWNSTREAM_SITE, ROAD_SITE):
            cam = by_name[name]
            road = "tidak_tergenang" if cam.water_kind == "jalan" else "tidak_relevan"
            history.append(
                {
                    "camera_id": cam.id, "captured_at": (start - timedelta(minutes=minutes)).isoformat(), "status": "normal", "road_flood": road,
                    "confidence": 0.84, "level": "normal", "previous": "normal", "confirmed": "normal", "needed": smoothing.READINGS_TO_RISE,
                    "recheck_minutes": settings.water_heartbeat_minutes, "reason": REASONS[road if cam.water_kind == "jalan" else "normal"],
                }
            )  # fmt: skip
    kept = json.loads(OUTPUT.read_text(encoding="utf-8"))["steps"] if "--keep-insights" in sys.argv else None
    active: dict[tuple, dict] = {}  # peringatan aktif: kunci (jenis, kamera) → baris
    alert_seq = 0
    weather: dict[str, GridWeather] = {}
    last_signature, last_insight, steps = None, None, []
    expected = {minute: (note, expect) for minute, note, expect in STEPS}

    for minute in sorted({0, *RAIN, *(r[0] for r in READINGS), *expected}):
        at = start + timedelta(minutes=minute)
        if minute in RAIN:
            for grid_id, point in grid.items():
                now_mm, next_1h, next_3h, next_6h, probability = RAIN[minute] if grid_id in wet_grids else DRY
                weather[grid_id] = GridWeather(grid_id, now_mm, next_1h, next_3h, next_6h, probability, _hourly(at, next_1h, next_3h, next_6h, probability), point.name)

        for _, name, status, road_flood, confidence in (r for r in READINGS if r[0] == minute):
            cam = by_name[name]
            reading = smoothing.Reading(status, road_flood, confidence, "good", "sama" if status == "normal" else "sedikit_lebih_tinggi")
            readings[cam.id].insert(0, reading)
            if (level := smoothing.level_of(reading, cam.water_kind)) is not None:
                levels[cam.id].insert(0, (at, level))
            before = statuses[cam.id]["water_status"]
            confirmed, needs_verification = smoothing.confirm_water_status(before, readings[cam.id], cam.water_kind)
            # Catatan yang sama dengan yang disimpan worker di tiap pembacaan; web menggambar linimasa darinya.
            history.append(
                {
                    "camera_id": cam.id, "captured_at": at.isoformat(), "status": status, "road_flood": road_flood, "confidence": confidence,
                    "level": smoothing.LEVELS[level] if level is not None else None, "previous": before, "confirmed": confirmed,
                    "needed": smoothing.READINGS_TO_RISE, "reason": REASONS[road_flood if cam.water_kind == "jalan" else status],
                    # Sama dengan worker: saat hujan, lokasi diperiksa lebih rapat.
                    "recheck_minutes": settings.water_rain_heartbeat_minutes
                    if weather[cam.weather_grid_id].rain_for_trigger_mm > settings.rain_trigger_mm
                    else settings.water_heartbeat_minutes,
                }
            )  # fmt: skip
            statuses[cam.id] |= {"water_status": confirmed, "road_flood": road_flood, "water_confidence": confidence, "needs_verification": needs_verification}
            if confirmed != before:
                statuses[cam.id]["water_status_since"] = at.isoformat()

        # Tren dan skor risiko dihitung ulang untuk semua lokasi, seperti worker di tiap siklus.
        confirmed_now = {cam.id: statuses[cam.id]["water_status"] for cam in sites}
        for cam in sites:
            confirmed = confirmed_now[cam.id]
            water_trend = trend.water_trend(smoothing.LEVELS.index(confirmed), levels[cam.id], at)
            above = upstream.worst_upstream(cam.id, links, confirmed_now)
            assessed = risk.risk_score(confirmed, water_trend, above[1] if above else None, weather[cam.weather_grid_id].precip_next_3h_mm)
            if above:
                assessed.components["inputs"]["upstream_name"] = next(c.name for c in cameras if c.id == above[0].upstream_id)
            statuses[cam.id] |= {"water_trend": water_trend, "risk_score": assessed.score, "risk_level": assessed.level, "risk_components": assessed.components}

        desired = [
            *alerts.water_alerts(sites, statuses, weather),
            *alerts.upstream_alerts(sites, statuses, links),
            alerts.rain_alert(weather, already_active=("heavy_rain", None) in active),
        ]
        current = {}
        for alert in (a for a in desired if a is not None):
            previous = active.get(alert.key)
            if previous is None:
                alert_seq += 1
            changed = previous is None or (previous["level"], previous["message"]) != (alert.level, alert.message)
            current[alert.key] = {
                "id": previous["id"] if previous else f"sim-peringatan-{alert_seq}",
                "created_at": previous["created_at"] if previous else at.isoformat(),
                "updated_at": at.isoformat() if changed else previous["updated_at"],
                "type": alert.type, "level": alert.level, "camera_id": alert.camera_id, "title": alert.title, "message": alert.message,
            }  # fmt: skip
        active = current

        if minute not in expected:
            continue
        note, expect = expected[minute]
        for name, status in expect.items():
            assert statuses[by_name[name].id]["water_status"] == status, f"menit {minute}: {name} = {statuses[by_name[name].id]['water_status']}, diharapkan {status}"

        latest = {row["camera_id"]: row | {"smoothing": {"level": row["level"], "needed": row["needed"]}} for row in history}
        facts = insights.build_facts(cameras, statuses, weather, list(active.values()), at, links, latest)
        current_signature = insights.signature(facts)
        if kept is not None:
            # Insight yang sudah diperiksa dipakai lagi; hanya sah bila susunan langkahnya tidak berubah.
            assert kept[len(steps)]["minute"] == minute and kept[len(steps)]["overall_level"] == facts["overall_level"], f"menit {minute}: langkah berubah, susun ulang tanpa --keep-insights"
            last_insight = kept[len(steps)]["insight"]
        elif current_signature != last_signature and use_llm:
            result, info = insights.generate(facts, api_key=settings.openai_api_key, model=settings.openai_text_model)
            if result is None:
                raise SystemExit(f"menit {minute}: insight gagal disusun ({info['error']}); jalankan ulang")
            last_insight = {"id": f"sim-insight-{len(steps)}", "created_at": at.isoformat(), "model": info.get("model"), **result.model_dump()}
        last_signature = current_signature

        rank = {"awas": 0, "siaga": 1, "waspada": 2, "info": 3}
        steps.append(
            {
                "minute": minute,
                "at": at.isoformat(),
                "note": note,
                "overall_level": facts["overall_level"],
                "cameras": {cam.id: {key: statuses[cam.id][key] for key in CAMERA_FIELDS} for cam in sites},
                "readings": list(history),
                "alerts": sorted(active.values(), key=lambda row: (rank[row["level"]], row["created_at"])),
                "weather": [_web_weather(grid[grid_id], w, at) for grid_id, w in weather.items()],
                "insight": last_insight,
            }
        )
        named = {name: statuses[by_name[name].id] for name in (UPSTREAM_SITE, DOWNSTREAM_SITE, ROAD_SITE)}
        print(
            f"menit {minute:3d} [{facts['overall_level']:15}] "
            + " | ".join(f"{name}: {s['water_status']}/{s['water_trend']}/risiko {s['risk_score']}" for name, s in named.items())
            + f" | peringatan: {[row['type'] for row in active.values()]}"
            + (f"\n          insight: {last_insight['headline']}" if last_insight else "")
        )

    if not use_llm:
        print("\n(--no-llm: berkas skenario tidak ditulis)")
        return
    scenario = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "description": "Masukan buatan (penilaian AI dan prakiraan hujan), dijalankan melalui aturan dan LLM yang sama dengan worker.",
        "cast": {"upstream": by_name[UPSTREAM_SITE].id, "downstream": by_name[DOWNSTREAM_SITE].id, "road": by_name[ROAD_SITE].id},
        "steps": steps,
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    # Ringkas tanpa indentasi: berkas ini ikut dikirim ke browser pembuka halaman simulasi.
    OUTPUT.write_text(json.dumps(scenario, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"\ntersimpan: {OUTPUT} ({OUTPUT.stat().st_size // 1024} KB, {len(steps)} langkah)")


CAMERA_FIELDS = (
    "water_status", "water_status_since", "water_trend", "road_flood", "trash", "water_confidence",
    "needs_verification", "risk_score", "risk_level", "risk_components",
)  # fmt: skip


def _hourly(at: datetime, next_1h: float, next_3h: float, next_6h: float, probability: float) -> list[dict]:
    """Prakiraan per jam yang konsisten dengan jumlah 1, 3, dan 6 jam di atas."""
    first = at.replace(minute=0, second=0, microsecond=0) + timedelta(hours=1)
    per_hour = [next_1h, *[(next_3h - next_1h) / 2] * 2, *[(next_6h - next_3h) / 3] * 3, *[0.0] * 6]
    return [
        {"time": int((first + timedelta(hours=i)).timestamp()), "precipitation": round(mm, 1), "probability": probability if i < 6 else 20}
        for i, mm in enumerate(per_hour)
    ]


def _web_weather(point, w: GridWeather, at: datetime) -> dict:
    return {
        "grid_id": w.grid_id, "name": point.name or w.grid_id, "lat": point.lat, "lng": point.lng, "fetched_at": at.isoformat(),
        "precip_now_mm": w.precip_now_mm, "precip_next_1h_mm": w.precip_next_1h_mm, "precip_next_3h_mm": w.precip_next_3h_mm,
        "precip_next_6h_mm": w.precip_next_6h_mm, "precip_prob_max_3h": w.precip_prob_max_3h, "hourly": w.hourly,
    }  # fmt: skip


if __name__ == "__main__":
    main()
