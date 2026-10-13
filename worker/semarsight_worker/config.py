"""Konfigurasi worker, dibaca dari environment.

Nilai diambil dari variabel environment; file `.env` di root repo dimuat lebih dulu
tanpa menimpa variabel yang sudah diset (mis. oleh systemd `EnvironmentFile`).
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]


def _get(name: str, default: str) -> str:
    value = os.environ.get(name, "").strip()
    return value or default


def _get_bool(name: str, default: bool) -> bool:
    return _get(name, str(default)).lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    supabase_url: str
    supabase_service_role_key: str
    supabase_storage_bucket: str

    cycle_seconds: int
    max_concurrency: int
    frame_timeout_seconds: int
    frames_dir: Path
    frames_retention_days: int
    http_user_agent: str
    timezone: str

    yolo_model: str
    yolo_conf: float

    openai_api_key: str
    ai_vision_enabled: bool
    ai_daily_call_cap: int
    openai_vision_model: str
    openai_text_model: str
    water_only_featured: bool
    water_change_threshold: float
    water_heartbeat_minutes: int
    water_rain_heartbeat_minutes: int
    rain_trigger_mm: float
    weather_interval_minutes: int
    insight_interval_minutes: int


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    load_dotenv(REPO_ROOT / ".env", override=False)
    return Settings(
        supabase_url=_get("SUPABASE_URL", "").rstrip("/"),
        supabase_service_role_key=_get("SUPABASE_SERVICE_ROLE_KEY", ""),
        supabase_storage_bucket=_get("SUPABASE_STORAGE_BUCKET", "snapshots"),
        cycle_seconds=int(_get("CYCLE_SECONDS", "300")),
        max_concurrency=int(_get("MAX_CONCURRENCY", "8")),
        frame_timeout_seconds=int(_get("FRAME_TIMEOUT_SECONDS", "20")),
        frames_dir=Path(_get("FRAMES_DIR", "./frames")),
        frames_retention_days=int(_get("FRAMES_RETENTION_DAYS", "14")),
        http_user_agent=_get("HTTP_USER_AGENT", "Mozilla/5.0 (compatible; SemarSight/0.1)"),
        timezone=_get("TIMEZONE", "Asia/Jakarta"),
        yolo_model=_get("YOLO_MODEL", "yolo11s.pt"),
        yolo_conf=float(_get("YOLO_CONF", "0.25")),
        openai_api_key=_get("OPENAI_API_KEY", ""),
        ai_vision_enabled=_get_bool("AI_VISION_ENABLED", True),
        ai_daily_call_cap=int(_get("AI_DAILY_CALL_CAP", "3000")),
        openai_vision_model=_get("OPENAI_VISION_MODEL", ""),
        openai_text_model=_get("OPENAI_TEXT_MODEL", ""),
        water_only_featured=_get_bool("WATER_ONLY_FEATURED", True),
        water_change_threshold=float(_get("WATER_CHANGE_THRESHOLD", "0.12")),
        water_heartbeat_minutes=int(_get("WATER_HEARTBEAT_MINUTES", "30")),
        water_rain_heartbeat_minutes=int(_get("WATER_RAIN_HEARTBEAT_MINUTES", "10")),
        rain_trigger_mm=float(_get("RAIN_TRIGGER_MM", "2.0")),
        weather_interval_minutes=int(_get("WEATHER_INTERVAL_MINUTES", "30")),
        insight_interval_minutes=int(_get("INSIGHT_INTERVAL_MINUTES", "15")),
    )
