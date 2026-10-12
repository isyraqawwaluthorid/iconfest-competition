"""Insight situasi: fakta yang dihitung sistem dirangkum LLM teks menjadi kartu Kondisi → Penyebab → Dampak → Tindakan.

LLM menerima angka dan status, bukan gambar, dan hanya menjelaskan. Tingkat keseluruhan ditetapkan
aturan di sini, dan jawaban LLM diperiksa lagi sebelum disimpan: angka yang tidak ada di fakta,
satuan yang tidak diukur sistem, dan tingkat yang melampaui aturan tidak pernah sampai ke pengguna.
"""

from __future__ import annotations

import json
import logging
import re
from collections import Counter
from datetime import datetime, timedelta
from functools import lru_cache
from pathlib import Path
from typing import Any
from zoneinfo import ZoneInfo

import httpx
from pydantic import ValidationError

from . import alerts
from .config import REPO_ROOT, Settings
from .db import Database
from .fusion.upstream import Link
from .models import CameraRow, InsightResult
from .openai_api import RESPONSES_URL, json_schema_format, output_text
from .sources.openmeteo import GridWeather

log = logging.getLogger(__name__)

SCOPE = "situasi"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "insight.md"
SCHEMA_PATH = REPO_ROOT / "ai" / "schemas" / "insight.schema.json"
WIB = ZoneInfo("Asia/Jakarta")
MONTHS = ("Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des")

AI_TIMEOUT_SECONDS = 60
MAX_ATTEMPTS = 2  # satu percobaan ulang, tidak lebih
MAX_OUTPUT_TOKENS = 3000
MAX_ITEMS = 5
MAX_ITEMS_CALM = 2  # saat tidak ada yang perlu diperhatikan, layar tidak diisi demi mengisi
MAX_AGE = timedelta(minutes=60)  # tanpa perubahan pun, insight disegarkan agar waktunya tidak tampak usang
TOP_RISK = 3
TOP_TRAFFIC = 3

ELEVATED = ("waspada", "siaga", "awas")
LEVEL_ORDER = ("normal", *ELEVATED)
RISING = ("naik", "naik_cepat")
FLOODED = ("genangan_ringan", "genangan_sedang", "genangan_tinggi")
RAIN_CLASS_BOUNDS = (1.0, 5.0, 10.0, 20.0)  # sama dengan kelas hujan di peta web
RAIN_CLASSES = ("tidak_hujan", "ringan", "sedang", "lebat", "sangat_lebat")
LEVEL_RANK = {"aman": 0, "perlu_perhatian": 1, "waspada": 2, "siaga": 3, "awas": 4}
ITEM_RANK = {"info": 0, "waspada": 1, "siaga": 2, "awas": 3}
# Tingkat tertinggi yang boleh dipakai satu item, mengikuti tingkat keseluruhan dari aturan.
ITEM_CEILING = {"aman": "info", "perlu_perhatian": "info", "waspada": "waspada", "siaga": "siaga", "awas": "awas"}

NUMBER = re.compile(r"\d+(?:[.,]\d+)?")
# Besaran yang tidak dikumpulkan sistem: tinggi air, kecepatan, debit.
UNMEASURED_UNIT = re.compile(r"\d\s*(?:cm|sentimeter|meter|m3|m³|km/jam|kpj|liter)\b", re.IGNORECASE)
DEFINITION_NUMBERS = (1.0, 3.0, 6.0, 24.0)  # "3 jam ke depan" dan sejenisnya adalah definisi, bukan data


def build_facts(
    cameras: list[CameraRow],
    statuses: dict[str, dict[str, Any]],
    weather: dict[str, GridWeather],
    active_alerts: list[dict[str, Any]],
    now: datetime,
    links: list[Link] | None = None,
    latest_readings: dict[str, dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Ringkas keadaan terbaru menjadi fakta untuk LLM. Hanya berisi yang benar-benar dikumpulkan sistem.

    `latest_readings`: penilaian AI terakhir per kamera beserta catatan penghalusannya (`smoothing`),
    untuk menyebut lokasi yang baru sekali dinilai naik dan masih menunggu konfirmasi.
    """
    links = links or []
    names = {cam.id: cam.name for cam in cameras}

    def area(cam: CameraRow) -> str | None:
        local = weather.get(cam.weather_grid_id or "")
        return (local.grid_name or local.grid_id) if local else None

    def relations(cam: CameraRow) -> dict[str, Any]:
        """Lokasi hulu dan hilir kamera ini, untuk menjelaskan dari mana air datang dan ke mana dampaknya."""
        return {
            "upstream": [
                {"name": names[link.upstream_id], "status": statuses.get(link.upstream_id, {}).get("water_status")}
                for link in links
                if link.downstream_id == cam.id and link.upstream_id in names
            ],
            "downstream": [
                {
                    "name": names[link.downstream_id],
                    "eta_minutes": link.lag_minutes,
                    "eta_source": "dipelajari dari kejadian" if link.lag_is_learned else "perkiraan awal",
                }
                for link in links
                if link.upstream_id == cam.id and link.downstream_id in names
            ],
        }

    sites = [
        (cam, statuses[cam.id])
        for cam in cameras
        if "water" in cam.modules and statuses.get(cam.id, {}).get("water_status")
    ]
    attention = [_water_fact(cam, status, area(cam), weather) | relations(cam) for cam, status in sites if _needs_attention(status)]
    # Menunggu konfirmasi: penilaian terakhir dihitung aturan di atas status resmi, tetapi baru sekali.
    pending = []
    for cam, status in sites:
        reading = (latest_readings or {}).get(cam.id) or {}
        counted = (reading.get("smoothing") or {}).get("level")
        if counted in LEVEL_ORDER and LEVEL_ORDER.index(counted) > LEVEL_ORDER.index(status["water_status"] if status["water_status"] in LEVEL_ORDER else "normal"):
            pending.append(
                {
                    "camera_id": cam.id,
                    "name": cam.name,
                    "area": area(cam),
                    "confirmed_status": status["water_status"],
                    "ai_reading": counted,
                    "ai_confidence": reading.get("confidence"),
                    "at_wib": _wib(reading.get("captured_at")),
                    "readings_needed": (reading.get("smoothing") or {}).get("needed"),
                }
            )
    ranked = sorted((site for site in sites if site[1].get("risk_score") is not None), key=lambda site: -site[1]["risk_score"])
    trash_heavy = [{"camera_id": cam.id, "name": cam.name, "area": area(cam)} for cam, status in sites if status.get("trash") == "banyak"]

    rain_areas = sorted(weather.values(), key=lambda w: -w.precip_next_3h_mm)
    peak_rain = rain_areas[0].precip_next_3h_mm if rain_areas else None

    traffic = [
        (cam, statuses[cam.id])
        for cam in cameras
        if "traffic" in cam.modules
        and statuses.get(cam.id, {}).get("health") == "live"
        and statuses[cam.id].get("density_index") is not None
    ]
    # Pembanding sementara berasal dari kurang dari tiga hari, jadi tingkat kepadatannya tidak ikut dikirim:
    # yang belum layak disimpulkan tidak perlu sampai ke LLM.
    comparable = [(cam, status) for cam, status in traffic if not status.get("baseline_is_provisional")]
    traffic_fact: dict[str, Any] = {
        "sites_with_index": len(traffic),
        "baseline": "per_jam" if traffic and len(comparable) == len(traffic) else "sementara",
    }
    if comparable:
        busiest = sorted(comparable, key=lambda site: -site[1]["density_index"])[:TOP_TRAFFIC]
        traffic_fact |= {
            "sites_comparable": len(comparable),
            "by_level": dict(Counter(status.get("density_level") for _, status in comparable)),
            "anomalies": [_traffic_fact(cam, status, area(cam)) for cam, status in comparable if status.get("is_anomaly")],
            "busiest": [_traffic_fact(cam, status, area(cam)) for cam, status in busiest],
        }

    live = sum(statuses.get(cam.id, {}).get("health") == "live" for cam in cameras)
    featured_offline = [
        cam.name
        for cam in cameras
        if cam.is_featured and (statuses.get(cam.id, {}).get("consecutive_failures") or 0) >= alerts.OFFLINE_AFTER_FAILURES
    ]
    by_status = Counter(status["water_status"] for _, status in sites)
    rising = sum(status.get("water_trend") in RISING for _, status in sites)

    limits = [
        "Status air adalah penilaian visual AI atas gambar CCTV, bukan pengukuran tinggi air.",
        f"Lokasi air yang dipantau hanya {len(sites)} titik; wilayah tanpa titik pantau tidak diketahui kondisinya.",
    ]
    if not links:
        limits.append("Hubungan hulu-hilir antar lokasi belum diisi, jadi pengaruh kondisi hulu belum ikut dihitung dalam skor risiko.")
    else:
        limits.append(
            f"Hubungan hulu-hilir baru diisi untuk {len(links)} pasangan lokasi; lokasi lain belum memperhitungkan kondisi hulu. "
            "Jeda waktu hulu ke hilir masih perkiraan awal kecuali disebut dipelajari dari kejadian."
        )
    if traffic_fact["baseline"] == "sementara":
        limits.append(
            "Pembanding kepadatan lalu lintas masih sementara (kurang dari tiga hari data pada jam yang sama), "
            "sehingga belum dipakai untuk menyimpulkan kepadatan."
        )
    limits.append("Prakiraan hujan berasal dari model Open-Meteo, bukan pengukuran di lokasi." if rain_areas else "Data hujan belum tersedia.")

    return {
        "generated_at_wib": _wib(now),
        "scope": SCOPE,
        # Lokasi yang penilaiannya kurang yakin tetap masuk `attention` untuk disebut, tetapi tidak menaikkan tingkat kota.
        "overall_level": _overall_level(by_status, rising, peak_rain, bool(pending or active_alerts or featured_offline)),
        "water": {
            "sites_monitored": len(sites),
            "by_status": dict(by_status),
            "rising": rising,
            "pending_confirmation": pending,
            "attention": attention,
            "highest_risk": [
                {
                    "camera_id": cam.id,
                    "name": cam.name,
                    "area": area(cam),
                    "status": status["water_status"],
                    "trend": status.get("water_trend"),
                    "risk_score": status["risk_score"],
                    "risk_level": status.get("risk_level"),
                }
                for cam, status in ranked[:TOP_RISK]
            ],
            "trash_heavy": trash_heavy,
        },
        "rain": {
            "peak_next_3h_mm": peak_rain,
            "peak_category": RAIN_CLASSES[_rain_class(peak_rain)] if peak_rain is not None else None,
            "peak_area": (rain_areas[0].grid_name or rain_areas[0].grid_id) if rain_areas else None,
            "areas": [
                {
                    "area": w.grid_name or w.grid_id,
                    "now_mm": w.precip_now_mm,
                    "next_1h_mm": w.precip_next_1h_mm,
                    "next_3h_mm": w.precip_next_3h_mm,
                    "next_6h_mm": w.precip_next_6h_mm,
                    "probability_max_3h_pct": w.precip_prob_max_3h,
                }
                for w in rain_areas
            ],
        },
        "traffic": traffic_fact,
        "cameras": {"active": len(cameras), "live": live, "offline": len(cameras) - live, "featured_offline": featured_offline},
        "alerts": [
            {
                "type": row["type"],
                "level": row["level"],
                "title": row["title"],
                "message": row["message"],
                "camera_id": row.get("camera_id"),
                "since_wib": _wib(row.get("created_at")),
            }
            for row in active_alerts
        ],
        "limits": limits,
    }


def signature(facts: dict[str, Any]) -> str:
    """Bagian fakta yang, bila berubah, layak dijelaskan ulang. Angka yang bergoyang tiap siklus tidak ikut."""
    water = facts.get("water", {})
    return json.dumps(
        {
            "level": facts.get("overall_level"),
            "water": sorted(
                [w["camera_id"], w["status"], w.get("trend") in RISING, w.get("road_flood"), bool(w.get("needs_verification"))]
                for w in water.get("attention", [])
            ),
            "pending": sorted([p["camera_id"], p["ai_reading"]] for p in water.get("pending_confirmation", [])),
            "trash": sorted(t["camera_id"] for t in water.get("trash_heavy", [])),
            "rain": sorted([a["area"], _rain_class(a["next_3h_mm"])] for a in facts.get("rain", {}).get("areas", [])),
            "traffic": sorted(t["camera_id"] for t in facts.get("traffic", {}).get("anomalies", [])),
            "alerts": sorted([a["type"], a.get("camera_id") or "", a["level"]] for a in facts.get("alerts", [])),
            "featured_offline": sorted(facts.get("cameras", {}).get("featured_offline", [])),
        },
        sort_keys=True,
    )


def generate(facts: dict[str, Any], *, api_key: str, model: str) -> tuple[InsightResult | None, dict[str, Any]]:
    """Minta LLM menulis insight dari fakta. Tanpa hasil yang lolos pemeriksaan, mengembalikan None dan sebabnya."""
    payload = {
        "model": model,
        "instructions": _system_prompt(),
        "reasoning": {"effort": "low"},
        "input": [{"role": "user", "content": [{"type": "input_text", "text": json.dumps({"facts": facts}, ensure_ascii=False)}]}],
        "text": {"format": json_schema_format(_schema())},
        "max_output_tokens": MAX_OUTPUT_TOKENS,
    }
    failure = "tidak diketahui"
    for _ in range(MAX_ATTEMPTS):
        try:
            response = httpx.post(RESPONSES_URL, headers={"Authorization": f"Bearer {api_key}"}, json=payload, timeout=AI_TIMEOUT_SECONDS)
            response.raise_for_status()
            body = response.json()
            result, rejected = enforce(InsightResult.model_validate_json(output_text(body)), facts)
            if result is not None:
                return result, {"model": body.get("model"), "usage": body.get("usage"), "rejected": rejected}
            failure = "ditolak pemeriksaan (" + "; ".join(rejected)[:200] + ")"
        except httpx.TimeoutException:
            failure = "timeout"
        except httpx.HTTPStatusError as exc:
            failure = f"HTTP {exc.response.status_code}"
            if exc.response.status_code in (400, 401, 403, 404):
                break  # permintaan salah atau kunci ditolak: mengulang tidak akan membantu
        except httpx.HTTPError as exc:
            failure = type(exc).__name__
        except (ValidationError, ValueError, KeyError) as exc:
            failure = f"output tidak valid ({type(exc).__name__})"
    return None, {"error": failure}


def enforce(result: InsightResult, facts: dict[str, Any]) -> tuple[InsightResult | None, list[str]]:
    """Terapkan aturan pada jawaban LLM. Mengembalikan hasil yang boleh ditampilkan dan daftar yang dibuang.

    Ringkasan yang memuat angka di luar fakta membatalkan seluruh jawaban; item yang memuatnya dibuang.
    Tingkat keseluruhan selalu diambil dari aturan, dan tingkat item tidak boleh melampauinya.
    """
    known = known_numbers(facts)
    problems = ungrounded(f"{result.headline} {result.summary}", known)
    if problems:
        return None, [f"ringkasan: {', '.join(problems)}"]

    ceiling = ITEM_CEILING[facts["overall_level"]]
    camera_ids = _camera_ids(facts)
    items, rejected = [], []
    for item in result.items[: MAX_ITEMS_CALM if facts["overall_level"] == "aman" else MAX_ITEMS]:
        text = " ".join([item.title, item.body, item.cause, item.impact, *item.evidence, *(r.action for r in item.recommendations)])
        problems = ungrounded(text, known)
        if problems:
            rejected.append(f"{item.title}: {', '.join(problems)}")
            continue
        items.append(
            item.model_copy(
                update={
                    "level": item.level if ITEM_RANK[item.level] <= ITEM_RANK[ceiling] else ceiling,
                    "camera_ids": [camera_id for camera_id in item.camera_ids if camera_id in camera_ids],
                }
            )
        )
    if not items:
        return None, rejected or ["tidak ada item"]
    return result.model_copy(update={"overall_level": facts["overall_level"], "items": items}), rejected


def known_numbers(facts: dict[str, Any]) -> list[float]:
    """Semua angka yang boleh muncul di teks insight: nilai di fakta, angka dalam teksnya, dan jumlah isi daftar."""
    found = list(DEFINITION_NUMBERS)

    def walk(value: Any) -> None:
        if isinstance(value, bool) or value is None:
            return
        if isinstance(value, (int, float)):
            found.append(float(value))
            if 0 < value < 1:
                found.append(float(value) * 100)  # skor 0..1 boleh ditulis sebagai persen
        elif isinstance(value, str):
            found.extend(_parse(token) for token in NUMBER.findall(value))
        elif isinstance(value, dict):
            for key, child in value.items():
                if key != "camera_id":  # UUID penuh angka acak; bukan data yang boleh dikutip
                    walk(child)
        elif isinstance(value, list):
            found.append(float(len(value)))
            for child in value:
                walk(child)

    walk(facts)
    return found


def ungrounded(text: str, known: list[float]) -> list[str]:
    """Angka di `text` yang bukan pembulatan dari angka mana pun di fakta, dan satuan yang tidak diukur sistem."""
    problems = [f"satuan '{match.group(0)}'" for match in UNMEASURED_UNIT.finditer(text)]
    for token in NUMBER.findall(text):
        decimals = len(re.split("[.,]", token)[1]) if re.search("[.,]", token) else 0
        tolerance = 0.5 * 10**-decimals + 1e-9
        if not any(abs(_parse(token) - value) <= tolerance for value in known):
            problems.append(f"angka {token}")
    return problems


class InsightWriter:
    """Menulis insight situasi saat keadaan berubah, paling sering sekali per `INSIGHT_INTERVAL_MINUTES`.

    Kenaikan tingkat keseluruhan tidak menunggu jeda itu. Tanpa perubahan, insight disegarkan tiap `MAX_AGE`.
    """

    def __init__(self, settings: Settings, database: Database) -> None:
        self._settings = settings
        self._database = database
        self._interval = timedelta(minutes=settings.insight_interval_minutes)
        self._signature: str | None = None
        self._level: str | None = None
        self._written_at: datetime | None = None
        self._attempted_at: datetime | None = None
        self.enabled = bool(settings.openai_api_key and settings.openai_text_model) and not database.dry_run
        if self.enabled:
            self._restore()

    def update(
        self, cameras: list[CameraRow], weather: dict[str, GridWeather], now: datetime, links: list[Link] | None = None
    ) -> bool:
        """Dipanggil sekali per siklus, setelah status dan peringatan diperbarui. True jika insight baru ditulis."""
        if not self.enabled:
            return False
        facts = build_facts(
            cameras,
            self._database.insight_inputs(),
            weather,
            self._database.active_alerts(alerts.MANAGED_TYPES),
            now,
            links,
            self._database.latest_water_outcomes(),
        )
        reason = self._reason(facts, now)
        if reason is None:
            return False
        self._attempted_at = now
        result, info = generate(facts, api_key=self._settings.openai_api_key, model=self._settings.openai_text_model)
        if result is None:
            log.warning("insight tidak diperbarui: %s", info["error"])
            return False
        self._database.insert_insight(
            {
                "scope": SCOPE,
                "headline": result.headline,
                "body": result.model_dump(),
                "facts": facts,
                "model": info.get("model") or self._settings.openai_text_model,
            }
        )
        self._signature, self._level, self._written_at = signature(facts), facts["overall_level"], now
        for note in info["rejected"]:
            log.warning("insight: item dibuang karena memuat hal di luar fakta (%s)", note)
        log.info("insight baru (%s) [%s] %s", reason, result.overall_level, result.headline)
        return True

    def _reason(self, facts: dict[str, Any], now: datetime) -> str | None:
        if LEVEL_RANK[facts["overall_level"]] > LEVEL_RANK.get(self._level or "", 0) and self._written_at is not None:
            return "tingkat naik"
        if self._attempted_at is not None and now - self._attempted_at < self._interval:
            return None
        if self._written_at is None:
            return "pertama"
        if signature(facts) != self._signature:
            return "keadaan berubah"
        if now - self._written_at >= MAX_AGE:
            return "penyegaran berkala"
        return None

    def _restore(self) -> None:
        """Ambil jejak insight terakhir, agar restart tidak langsung memanggil LLM lagi."""
        try:
            latest = self._database.latest_insight(SCOPE)
        except Exception:  # noqa: BLE001 - tanpa jejak, insight pertama ditulis ulang saja
            log.exception("insight terakhir gagal dibaca")
            return
        if latest:
            self._signature = signature(latest["facts"])
            self._level = latest["facts"].get("overall_level")
            self._written_at = datetime.fromisoformat(latest["created_at"])


def _overall_level(by_status: Counter, rising: int, peak_rain: float | None, anything_to_watch: bool) -> str:
    """Tingkat keseluruhan dari aturan: status air terkonfirmasi lebih dulu, lalu prakiraan hujan."""
    for level in ("awas", "siaga"):
        if by_status[level]:
            return level
    rain = peak_rain or 0.0
    if by_status["waspada"] or rain >= alerts.VERY_HEAVY_RAIN_MM:
        return "waspada"
    if rising or rain >= alerts.HEAVY_RAIN_MM or anything_to_watch:
        return "perlu_perhatian"
    return "aman"


def _needs_attention(status: dict[str, Any]) -> bool:
    return bool(
        status.get("water_status") in (*ELEVATED, "tidak_dapat_dinilai")
        or status.get("water_trend") in RISING
        or status.get("road_flood") in FLOODED
        or status.get("needs_verification")
    )


def _water_fact(cam: CameraRow, status: dict[str, Any], area: str | None, weather: dict[str, GridWeather]) -> dict[str, Any]:
    components = status.get("risk_components") or {}
    local = weather.get(cam.weather_grid_id or "")
    return {
        "camera_id": cam.id,
        "name": cam.name,
        "kind": cam.water_kind,
        "area": area,
        "status": status["water_status"],
        "since_wib": _wib(status.get("water_status_since")),
        "trend": status.get("water_trend"),
        "road_flood": status.get("road_flood"),
        "trash": status.get("trash"),
        "ai_confidence": status.get("water_confidence"),
        "needs_verification": bool(status.get("needs_verification")),
        "risk_score": status.get("risk_score"),
        "risk_level": status.get("risk_level"),
        "risk_components": {name: components.get(name) for name in ("status", "trend", "upstream", "rain")},
        "rain_next_3h_mm": local.precip_next_3h_mm if local else None,
        "camera_live": status.get("health") == "live",
    }


def _traffic_fact(cam: CameraRow, status: dict[str, Any], area: str | None) -> dict[str, Any]:
    return {
        "camera_id": cam.id,
        "name": cam.name,
        "area": area,
        "density_index": status["density_index"],
        "density_level": status.get("density_level"),
    }


def _camera_ids(facts: dict[str, Any]) -> set[str]:
    found: set[str] = set()

    def walk(value: Any) -> None:
        if isinstance(value, dict):
            if value.get("camera_id"):
                found.add(value["camera_id"])
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)

    walk(facts)
    return found


def _rain_class(mm: float) -> int:
    return sum(mm >= bound for bound in RAIN_CLASS_BOUNDS)


def _parse(token: str) -> float:
    return float(token.replace(",", "."))


def _wib(at: datetime | str | None) -> str | None:
    if at is None:
        return None
    local = (datetime.fromisoformat(at) if isinstance(at, str) else at).astimezone(WIB)
    return f"{local.day} {MONTHS[local.month - 1]} {local.year} {local:%H.%M}"


@lru_cache(maxsize=1)
def _system_prompt() -> str:
    return PROMPT_PATH.read_text(encoding="utf-8")


@lru_cache(maxsize=1)
def _schema() -> dict:
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))
