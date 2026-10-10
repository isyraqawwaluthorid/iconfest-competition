"""Akses Supabase (service role): baca kamera, tulis status dan log, unggah snapshot.

Dalam mode `dry_run` semua pembacaan tetap berjalan, tetapi tidak ada yang ditulis.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from typing import Any

from supabase import Client, create_client

from .config import Settings
from .models import CameraRow

log = logging.getLogger(__name__)


class Database:
    def __init__(self, settings: Settings, *, dry_run: bool = False) -> None:
        if not settings.supabase_url or not settings.supabase_service_role_key:
            raise RuntimeError("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diisi di .env")
        self._client: Client = create_client(settings.supabase_url, settings.supabase_service_role_key)
        self._bucket = settings.supabase_storage_bucket
        self.dry_run = dry_run

    def active_cameras(self) -> list[CameraRow]:
        response = (
            self._client.table("cameras").select("*").eq("is_active", True).order("source_link_id").execute()
        )
        return [CameraRow.model_validate(row) for row in response.data]

    def failure_counts(self) -> dict[str, int]:
        """Jumlah kegagalan berturut-turut per kamera sebelum siklus ini."""
        response = self._client.table("camera_status").select("camera_id, consecutive_failures").execute()
        return {row["camera_id"]: row["consecutive_failures"] for row in response.data}

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

    def upload_snapshot(self, path: str, jpeg: bytes) -> None:
        if self.dry_run:
            return
        self._client.storage.from_(self._bucket).upload(
            path=path,
            file=jpeg,
            file_options={"content-type": "image/jpeg", "cache-control": "60", "upsert": "true"},
        )

    def set_system_status(self, key: str, value: dict[str, Any]) -> None:
        if self.dry_run:
            return
        self._client.table("system_status").upsert(
            {"key": key, "value": value, "updated_at": value["last_seen"]}
        ).execute()
