"""Kejadian: satu baris per periode sebuah lokasi air berstatus di atas normal (tabel `events`).

Kejadian dibuka saat status resmi naik dari normal, puncaknya diperbarui selama berlangsung, dan
ditutup saat status resmi kembali normal. Dasarnya status terkonfirmasi, bukan penilaian AI tunggal.
Jeda hulu → hilir dipelajari dari kejadian yang sudah tercatat.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from statistics import median
from typing import Any

LEVELS = ("normal", "waspada", "siaga", "awas")
MAX_SNAPSHOTS = 12  # gambar bukti yang diingat per kejadian
LAG_LOOKBACK = timedelta(hours=6)  # kenaikan hulu yang lebih lama dari ini tidak dianggap berhubungan


@dataclass(frozen=True)
class Change:
    """Yang perlu ditulis untuk satu lokasi pada satu siklus: kejadian baru, atau pembaruan kejadian yang terbuka."""

    insert: dict[str, Any] | None = None
    update: tuple[str, dict[str, Any]] | None = None
    opened: bool = False  # True jika siklus ini membuka kejadian (dipakai untuk belajar jeda)


def kind_of(water_kind: str | None) -> str:
    return "genangan_jalan" if water_kind == "jalan" else "luapan_sungai"


def _rank(status: str | None) -> int:
    return LEVELS.index(status) if status in LEVELS else 0


def step(
    camera_id: str,
    water_kind: str | None,
    before: str | None,
    after: str | None,
    open_event: dict[str, Any] | None,
    at: datetime,
    evidence_path: str | None,
) -> Change | None:
    """Tentukan perubahan kejadian satu lokasi dari status resmi sebelum (`before`) dan sesudah (`after`) siklus ini."""
    raised = _rank(after) > 0
    if open_event is None:
        if not raised:
            return None
        return Change(
            insert={
                "camera_id": camera_id,
                "kind": kind_of(water_kind),
                "started_at": at.isoformat(),
                "peak_at": at.isoformat(),
                "peak_status": after,
                "snapshot_paths": [evidence_path] if evidence_path else [],
            },
            opened=True,
        )

    fields: dict[str, Any] = {}
    if _rank(after) > _rank(open_event.get("peak_status")):
        fields |= {"peak_status": after, "peak_at": at.isoformat()}
    snapshots = list(open_event.get("snapshot_paths") or [])
    if evidence_path and evidence_path not in snapshots and len(snapshots) < MAX_SNAPSHOTS:
        fields["snapshot_paths"] = [*snapshots, evidence_path]
    if not raised:
        started = datetime.fromisoformat(open_event["started_at"])
        fields |= {"ended_at": at.isoformat(), "duration_minutes": max(0, round((at - started).total_seconds() / 60))}
    return Change(update=(open_event["id"], fields)) if fields else None


def learned_lag(upstream_starts: list[datetime], downstream_starts: list[datetime]) -> tuple[int, int] | None:
    """Jeda hulu → hilir (menit) sebagai median dari semua kejadian hilir yang didahului kenaikan hulu, dan jumlahnya.

    Untuk tiap kejadian di hilir diambil kenaikan hulu terakhir sebelumnya, paling lama `LAG_LOOKBACK`.
    """
    lags = []
    for down in downstream_starts:
        earlier = [up for up in upstream_starts if timedelta(0) <= down - up <= LAG_LOOKBACK]
        if earlier:
            lags.append((down - max(earlier)).total_seconds() / 60)
    return (round(median(lags)), len(lags)) if lags else None
