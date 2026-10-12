"""Hubungan hulu → hilir antar lokasi air (tabel `river_links`).

Status lokasi hulu ikut menentukan skor risiko lokasi hilirnya dan memunculkan peringatan dini.
Jeda waktu memakai perkiraan awal sampai bisa dipelajari dari kejadian yang terekam.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

LEVELS = ("normal", "waspada", "siaga", "awas")


@dataclass(frozen=True)
class Link:
    upstream_id: str
    downstream_id: str
    river_system: str
    lag_minutes: int
    lag_is_learned: bool  # False: masih perkiraan awal, belum ada kejadian untuk dipelajari


def links_from_rows(rows: list[dict[str, Any]]) -> list[Link]:
    return [
        Link(
            upstream_id=row["upstream_camera_id"],
            downstream_id=row["downstream_camera_id"],
            river_system=row["river_system"],
            lag_minutes=row["learned_lag_minutes"] or row["default_lag_minutes"],
            lag_is_learned=bool(row["learned_lag_minutes"]),
        )
        for row in rows
    ]


def worst_upstream(camera_id: str, links: list[Link], statuses: dict[str, str | None]) -> tuple[Link, str] | None:
    """Lokasi hulu kamera ini dengan status terburuk, atau None jika tidak punya hulu yang statusnya ditetapkan."""
    candidates = [(link, statuses.get(link.upstream_id)) for link in links if link.downstream_id == camera_id]
    known = [(link, status) for link, status in candidates if status in LEVELS]
    return max(known, key=lambda item: LEVELS.index(item[1]), default=None)
