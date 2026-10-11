"""Tren status air: bandingkan level sekarang dengan 30 dan 60 menit lalu."""

from __future__ import annotations

from datetime import datetime, timedelta

LOOKBACK_TOLERANCE = timedelta(minutes=45)  # pembacaan pembanding tidak boleh lebih tua dari ini


def level_at(history: list[tuple[datetime, int]], moment: datetime) -> int | None:
    """Level pembacaan terakhir pada atau sebelum `moment`. `history` terurut dari yang terbaru."""
    for at, level in history:
        if at <= moment:
            return level if moment - at <= LOOKBACK_TOLERANCE else None
    return None


def water_trend(now_level: int | None, history: list[tuple[datetime, int]], now: datetime) -> str:
    """`naik_cepat`, `naik`, `stabil`, `turun`, atau `tidak_diketahui` jika belum ada pembanding."""
    if now_level is None:
        return "tidak_diketahui"
    half_hour_ago = level_at(history, now - timedelta(minutes=30))
    hour_ago = level_at(history, now - timedelta(minutes=60))
    if half_hour_ago is None and hour_ago is None:
        return "tidak_diketahui"

    if (hour_ago is not None and now_level - hour_ago >= 2) or (half_hour_ago is not None and now_level - half_hour_ago >= 1):
        return "naik_cepat"
    if hour_ago is not None and now_level - hour_ago >= 1:
        return "naik"
    if now_level < max(level for level in (half_hour_ago, hour_ago) if level is not None):
        return "turun"
    return "stabil"
