"""Ringkasan keadaan sistem dari database dan log worker. Tidak mengubah apa pun.

    python scripts/status.py            # detak worker, lokasi air, peringatan, jeda 24 jam terakhir
    python scripts/status.py --hours 48

Dijalankan dari folder `worker/` dengan virtualenv aktif.
"""

from __future__ import annotations

import argparse
import re
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from supabase import create_client  # noqa: E402

from semarsight_worker import housekeeping  # noqa: E402
from semarsight_worker.config import get_settings  # noqa: E402

WIB = ZoneInfo("Asia/Jakarta")
CYCLE_DONE = re.compile(r"^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+ INFO\s+semarsight_worker: siklus selesai")
GAP_MINUTES = 7  # siklus normal berjarak 5 menit


def wib(iso: str | None) -> str:
    return datetime.fromisoformat(iso).astimezone(WIB).strftime("%d %b %H.%M") if iso else "-"


def cycle_gaps(log_dir: Path, since: datetime) -> tuple[int, list[tuple[datetime, datetime]]]:
    """Jumlah siklus selesai dan jeda di antaranya, dibaca dari log worker (waktu lokal mesin)."""
    files = sorted(log_dir.glob(f"{Path(housekeeping.LOG_FILE).name}*"), key=lambda p: p.stat().st_mtime)
    times: list[datetime] = []
    for file in files:
        for line in file.read_text(encoding="utf-8", errors="replace").splitlines():
            match = CYCLE_DONE.match(line)
            if match:
                at = datetime.strptime(match.group(1), "%Y-%m-%d %H:%M:%S").astimezone()
                if at >= since:
                    times.append(at)
    times.sort()
    gaps = [(a, b) for a, b in zip(times, times[1:]) if b - a > timedelta(minutes=GAP_MINUTES)]
    return len(times), gaps


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--hours", type=int, default=24, help="rentang waktu untuk menghitung jeda siklus")
    args = parser.parse_args()

    settings = get_settings()
    client = create_client(settings.supabase_url, settings.supabase_service_role_key)
    now = datetime.now(timezone.utc)

    heartbeat = client.table("system_status").select("value").eq("key", "worker").execute().data
    if heartbeat:
        value = heartbeat[0]["value"]
        age = (now - datetime.fromisoformat(value["last_seen"])).total_seconds() / 60
        cameras = value.get("cameras", {})
        print(
            f"Worker: terakhir terlihat {age:.0f} menit lalu ({wib(value['last_seen'])} WIB), siklus {value.get('cycle_ms', 0) / 1000:.0f} detik, "
            f"kamera hidup {cameras.get('live')}, beku {cameras.get('frozen')}, mati {cameras.get('dead')}, panggilan AI hari ini {value.get('ai_calls_today')}"
        )
        if age > 15:
            print("  PERHATIAN: worker tidak terlihat lebih dari 15 menit.")
    else:
        print("Worker: belum pernah mengirim detak.")

    featured = client.table("cameras").select("id, name, water_kind, reference_image_day, reference_image_night").eq("is_featured", True).order("name").execute().data
    status = {
        row["camera_id"]: row
        for row in client.table("camera_status").select("camera_id, health, water_status, water_trend, risk_score, risk_level, needs_verification").in_("camera_id", [c["id"] for c in featured]).execute().data
    }
    print(f"\nLokasi air unggulan ({len(featured)}):")
    for cam in featured:
        row = status.get(cam["id"], {})
        references = ("siang" if cam["reference_image_day"] else "-") + "/" + ("malam" if cam["reference_image_night"] else "-")
        flag = "  perlu verifikasi" if row.get("needs_verification") else ""
        print(
            f"  {cam['name'][:24]:24} {row.get('health') or '-':6} status={row.get('water_status') or '-':8} tren={row.get('water_trend') or '-':15} "
            f"risiko={row.get('risk_score') if row.get('risk_score') is not None else '-'} ({row.get('risk_level') or '-'}) ref={references}{flag}"
        )

    alerts = client.table("alerts").select("created_at, level, title, message").eq("is_active", True).order("created_at", desc=True).execute().data
    print(f"\nPeringatan aktif ({len(alerts)}):")
    for alert in alerts:
        print(f"  [{alert['level']}] {alert['title']} - {alert['message']} (sejak {wib(alert['created_at'])} WIB)")

    log_dir = settings.frames_dir / Path(housekeeping.LOG_FILE).parent
    if log_dir.is_dir():
        count, gaps = cycle_gaps(log_dir, datetime.now().astimezone() - timedelta(hours=args.hours))
        print(f"\nSiklus {args.hours} jam terakhir (dari log mesin ini): {count} selesai, {len(gaps)} jeda")
        for start, end in gaps:
            minutes = (end - start).total_seconds() / 60
            print(f"  jeda {minutes:.0f} menit: {start.astimezone(WIB):%d %b %H.%M} -> {end.astimezone(WIB):%d %b %H.%M} WIB")
    else:
        print(f"\nLog worker tidak ditemukan di {log_dir} (worker belum pernah berjalan di mesin ini).")


if __name__ == "__main__":
    main()
