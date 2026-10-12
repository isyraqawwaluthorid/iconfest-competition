"""Uji insight dari LLM atas keadaan terbaru, tanpa menulis ke database.

Dipakai setelah mengubah prompt atau susunan fakta, untuk membaca hasilnya sebelum worker memakainya.

    python scripts/probe_insight.py            # keadaan nyata saat ini
    python scripts/probe_insight.py naik       # keadaan buatan: satu pompa siaga dan naik cepat, satu jalan
                                               # tergenang, hujan lebat diprakirakan (hanya di memori)
    python scripts/probe_insight.py naik --facts   # hanya cetak fakta, tanpa memanggil LLM

Satu panggilan LLM teks berharga sekitar $0,001. Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from semarsight_worker import alerts, insights  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402
from semarsight_worker.db import Database  # noqa: E402
from semarsight_worker.fusion import risk, upstream  # noqa: E402
from semarsight_worker.main import refresh_weather  # noqa: E402


def simulate_rising(cameras, statuses, weather, now, links) -> list[dict]:
    """Ubah keadaan di memori menjadi kejadian air naik, lalu susun peringatannya dengan aturan yang sama dengan worker."""
    sites = [cam for cam in cameras if "water" in cam.modules and cam.is_calibrated and statuses.get(cam.id, {}).get("water_status")]
    upstream_ids = {link.upstream_id for link in links}
    # Lokasi yang punya hilir didahulukan, supaya peringatan dini hulu → hilir ikut teruji.
    pump = next((cam for cam in sites if cam.id in upstream_ids), None) or next(cam for cam in sites if cam.water_kind != "jalan")
    road = next(cam for cam in sites if cam.water_kind == "jalan")
    for grid_id in {pump.weather_grid_id, road.weather_grid_id} - {None}:
        weather[grid_id] = replace(weather[grid_id], precip_now_mm=6.2, precip_next_1h_mm=9.4, precip_next_3h_mm=18.5, precip_prob_max_3h=90)

    def raise_status(cam, status: str, trend: str, minutes_ago: int, **extra) -> None:
        scored = risk.risk_score(status, trend, None, weather[cam.weather_grid_id].precip_next_3h_mm)
        statuses[cam.id] |= {
            "water_status": status,
            "water_trend": trend,
            "water_status_since": (now - timedelta(minutes=minutes_ago)).isoformat(),
            "risk_score": scored.score,
            "risk_level": scored.level,
            "risk_components": scored.components,
            **extra,
        }

    raise_status(pump, "siaga", "naik_cepat", 25, trash="banyak")
    raise_status(road, "waspada", "naik", 10, road_flood="genangan_ringan")
    desired = [
        *alerts.water_alerts(sites, statuses, weather),
        *alerts.trash_alerts(sites, statuses, weather),
        *alerts.upstream_alerts(sites, statuses, links),
        alerts.rain_alert(weather, already_active=False),
    ]
    return [
        {"type": a.type, "level": a.level, "title": a.title, "message": a.message, "camera_id": a.camera_id, "created_at": now.isoformat()}
        for a in desired
        if a is not None
    ]


def main() -> None:
    args = sys.argv[1:]
    settings = get_settings()
    database = Database(settings, dry_run=True)
    now = datetime.now(timezone.utc)
    cameras = database.active_cameras()
    statuses = database.insight_inputs()
    weather: dict = {}
    refresh_weather(database, weather)
    active = database.active_alerts(alerts.MANAGED_TYPES)
    links = upstream.links_from_rows(database.river_links())
    if "naik" in args:
        active = simulate_rising(cameras, statuses, weather, now, links)
        print("=== KEADAAN BUATAN (tidak ditulis ke mana pun) ===")

    facts = insights.build_facts(cameras, statuses, weather, active, now, links)
    print(json.dumps(facts, ensure_ascii=False, indent=2))
    if "--facts" in args:
        return

    result, info = insights.generate(facts, api_key=settings.openai_api_key, model=settings.openai_text_model)
    print("\n=== HASIL ===")
    if result is None:
        raise SystemExit(f"Tidak ada insight: {info['error']}")
    print(json.dumps(result.model_dump(), ensure_ascii=False, indent=2))
    print("\nitem dibuang:", info["rejected"] or "tidak ada")
    print("pemakaian token:", info.get("usage"))


if __name__ == "__main__":
    main()
