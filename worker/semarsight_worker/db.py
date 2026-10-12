"""Akses Supabase (service role): baca kamera, tulis status dan log, unggah snapshot.

Dalam mode `dry_run` semua pembacaan tetap berjalan, tetapi tidak ada yang ditulis.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime
from typing import Any

import httpx
from supabase import Client, ClientOptions, create_client

from .config import Settings
from .models import CameraRow
from .sources.openmeteo import GridPoint

log = logging.getLogger(__name__)

PAGE_SIZE = 1000  # batas baris per permintaan PostgREST
HTTP_TIMEOUT_SECONDS = 30.0


class Database:
    def __init__(self, settings: Settings, *, dry_run: bool = False) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi di .env")
        # HTTP/1.1, bukan HTTP/2 bawaan pustaka: unggahan serentak dari banyak utas lewat satu sambungan
        # HTTP/2 sebagian gagal di Windows (WinError 10035). Dengan HTTP/1.1 tiap utas memakai sambungan sendiri.
        http_client = httpx.Client(http2=False, timeout=HTTP_TIMEOUT_SECONDS, follow_redirects=True)
        self._client: Client = create_client(
            settings.supabase_url,
            settings.supabase_service_role_key,
            options=ClientOptions(httpx_client=http_client),
        )
        self._bucket = settings.supabase_storage_bucket
        self.dry_run = dry_run

    def active_cameras(self) -> list[CameraRow]:
        response = (
            self._client.table("cameras").select("*").eq("is_active", True).order("source_link_id").execute()
        )
        return [CameraRow.model_validate(row) for row in response.data]

    def weather_grid(self) -> list[GridPoint]:
        response = self._client.table("weather_grid").select("id, name, lat, lng").order("id").execute()
        return [GridPoint(id=row["id"], lat=row["lat"], lng=row["lng"], name=row["name"] or "") for row in response.data]

    def insert_weather_readings(self, rows: list[dict[str, Any]]) -> None:
        if not rows or self.dry_run:
            return
        self._client.table("weather_readings").insert(rows).execute()

    def status_snapshot(self) -> dict[str, dict[str, Any]]:
        """Keadaan `camera_status` sebelum siklus ini: kegagalan berturut-turut dan status air terkonfirmasi."""
        response = (
            self._client.table("camera_status")
            .select("camera_id, consecutive_failures, water_status, water_status_since")
            .execute()
        )
        return {row["camera_id"]: row for row in response.data}

    def latest_water_call_times(self) -> dict[str, datetime]:
        """Waktu panggilan AI terakhir per kamera, agar restart tidak memicu panggilan serentak."""
        response = (
            self._client.table("water_readings")
            .select("camera_id, captured_at")
            .order("captured_at", desc=True)
            .limit(PAGE_SIZE)
            .execute()
        )
        latest: dict[str, datetime] = {}
        for row in response.data:
            latest.setdefault(row["camera_id"], datetime.fromisoformat(row["captured_at"]))
        return latest

    def water_calls_since(self, start: datetime) -> int:
        response = (
            self._client.table("water_readings")
            .select("id", count="exact")
            .gte("captured_at", start.isoformat())
            .limit(1)
            .execute()
        )
        return response.count or 0

    def recent_water_readings(self, camera_id: str, limit: int) -> list[dict[str, Any]]:
        """Pembacaan AI terbaru satu kamera, terurut dari yang paling baru."""
        response = (
            self._client.table("water_readings")
            .select("status, road_flood, confidence, quality, raw, captured_at")
            .eq("camera_id", camera_id)
            .eq("source", "live")
            .order("captured_at", desc=True)
            .limit(limit)
            .execute()
        )
        return response.data

    def insert_water_reading(self, row: dict[str, Any]) -> None:
        if self.dry_run:
            return
        self._client.table("water_readings").insert(row).execute()

    def download_object(self, path: str) -> bytes:
        return self._client.storage.from_(self._bucket).download(path)

    def recent_traffic(self, since: datetime) -> list[dict[str, Any]]:
        """Pembacaan lalu lintas `live` sejak `since`, urut waktu, untuk mengisi ulang baseline bergulir."""
        rows: list[dict[str, Any]] = []
        while True:
            page = (
                self._client.table("traffic_readings")
                .select("camera_id, captured_at, vehicle_total, persons, quality, is_night")
                .eq("source", "live")
                .gte("captured_at", since.isoformat())
                .order("captured_at")
                .order("id")
                .range(len(rows), len(rows) + PAGE_SIZE - 1)
                .execute()
                .data
            )
            rows.extend(page)
            if len(page) < PAGE_SIZE:
                return rows

    def insert_traffic_readings(self, rows: list[dict[str, Any]]) -> None:
        if not rows or self.dry_run:
            return
        self._client.table("traffic_readings").insert(rows).execute()

    def insert_health_checks(self, rows: list[dict[str, Any]]) -> None:
        if not rows or self.dry_run:
            return
        self._client.table("health_checks").insert(rows).execute()

    def upsert_camera_status(self, rows: list[dict[str, Any]]) -> None:
        """Perbarui `camera_status`; hanya kolom yang ada di tiap baris yang ditimpa."""
        if not rows or self.dry_run:
            return
        # PostgREST mewajibkan semua baris dalam satu permintaan punya kolom yang sama.
        batches: dict[frozenset[str], list[dict[str, Any]]] = defaultdict(list)
        for row in rows:
            batches[frozenset(row)].append(row)
        for batch in batches.values():
            self._client.table("camera_status").upsert(batch, on_conflict="camera_id").execute()

    def alert_inputs(self) -> dict[str, dict[str, Any]]:
        """Keadaan `camera_status` setelah siklus ini, sebatas kolom yang dipakai aturan peringatan."""
        response = (
            self._client.table("camera_status")
            .select(
                "camera_id, consecutive_failures, last_live_at, water_status, water_status_since, water_trend, "
                "road_flood, trash, risk_level"
            )
            .execute()
        )
        return {row["camera_id"]: row for row in response.data}

    def active_alerts(self, types: tuple[str, ...]) -> list[dict[str, Any]]:
        response = (
            self._client.table("alerts")
            .select("id, type, camera_id, level, title, message, created_at")
            .eq("is_active", True)
            .eq("source", "live")
            .in_("type", list(types))
            .execute()
        )
        return response.data

    def river_links(self) -> list[dict[str, Any]]:
        response = (
            self._client.table("river_links")
            .select("upstream_camera_id, downstream_camera_id, river_system, default_lag_minutes, learned_lag_minutes")
            .execute()
        )
        return response.data

    def insight_inputs(self) -> dict[str, dict[str, Any]]:
        """Keadaan `camera_status` terbaru, sebatas kolom yang dirangkum menjadi fakta insight."""
        response = (
            self._client.table("camera_status")
            .select(
                "camera_id, health, consecutive_failures, water_status, water_status_since, water_trend, road_flood, "
                "trash, water_confidence, needs_verification, risk_score, risk_level, risk_components, "
                "density_index, density_level, is_anomaly, baseline_is_provisional"
            )
            .execute()
        )
        return {row["camera_id"]: row for row in response.data}

    def latest_water_outcomes(self) -> dict[str, dict[str, Any]]:
        """Penilaian AI terakhir per kamera beserta catatan penghalusannya, untuk mengenali yang menunggu konfirmasi."""
        response = (
            self._client.table("water_readings")
            .select("camera_id, captured_at, status, confidence, raw")
            .eq("source", "live")
            .order("captured_at", desc=True)
            .limit(200)
            .execute()
        )
        latest: dict[str, dict[str, Any]] = {}
        for row in response.data:
            if row["camera_id"] not in latest:
                raw = row.pop("raw") or {}
                latest[row["camera_id"]] = row | {"smoothing": raw.get("smoothing")}
        return latest

    def latest_insight(self, scope: str) -> dict[str, Any] | None:
        response = (
            self._client.table("insights")
            .select("created_at, facts")
            .eq("scope", scope)
            .eq("source", "live")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        return response.data[0] if response.data else None

    def insert_insight(self, row: dict[str, Any]) -> None:
        if self.dry_run:
            return
        self._client.table("insights").insert(row).execute()

    def insert_alerts(self, rows: list[dict[str, Any]]) -> None:
        if not rows or self.dry_run:
            return
        self._client.table("alerts").insert(rows).execute()

    def update_alert(self, alert_id: str, fields: dict[str, Any]) -> None:
        if self.dry_run:
            return
        self._client.table("alerts").update(fields).eq("id", alert_id).execute()

    def resolve_alerts(self, alert_ids: list[str], at: datetime) -> None:
        if not alert_ids or self.dry_run:
            return
        self._client.table("alerts").update({"is_active": False, "resolved_at": at.isoformat()}).in_("id", alert_ids).execute()

    def upload_snapshot(self, path: str, jpeg: bytes) -> None:
        if self.dry_run:
            return
        self._client.storage.from_(self._bucket).upload(
            path=path,
            file=jpeg,
            file_options={"content-type": "image/jpeg", "cache-control": "60", "upsert": "true"},
        )

    def list_objects(self, folder: str) -> list[str]:
        """Nama isi satu folder Storage (berkas dan subfolder), tanpa menelusuri ke dalam."""
        items = self._client.storage.from_(self._bucket).list(folder, {"limit": 1000})
        return [item["name"] for item in items]

    def remove_objects(self, paths: list[str]) -> None:
        if not paths or self.dry_run:
            return
        self._client.storage.from_(self._bucket).remove(paths)

    def set_system_status(self, key: str, value: dict[str, Any]) -> None:
        if self.dry_run:
            return
        self._client.table("system_status").upsert(
            {"key": key, "value": value, "updated_at": value["last_seen"]}
        ).execute()
