"""Skor risiko per lokasi air: jumlah berbobot empat komponen yang ditampilkan terbuka di UI."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

WEIGHTS = {"status": 0.40, "trend": 0.20, "upstream": 0.20, "rain": 0.20}
STATUS_VALUE = {"normal": 0.0, "waspada": 0.4, "siaga": 0.7, "awas": 1.0}
TREND_VALUE = {"naik_cepat": 1.0, "naik": 0.5}  # stabil, turun, dan tidak diketahui bernilai 0
RAIN_FULL_MM = 20.0  # prakiraan hujan 3 jam yang dianggap risiko penuh
LEVEL_UPPER_BOUNDS = ((0.30, "rendah"), (0.55, "sedang"), (0.75, "tinggi"))
TOP_LEVEL = "sangat_tinggi"


@dataclass(frozen=True)
class Risk:
    score: float
    level: str
    components: dict[str, Any]


def risk_score(
    status: str | None, trend: str | None, upstream_status: str | None, rain_next_3h_mm: float | None
) -> Risk | None:
    """Skor 0..1 untuk satu lokasi, atau None jika status airnya belum ditetapkan."""
    if status not in STATUS_VALUE:
        return None
    components = {
        "status": STATUS_VALUE[status],
        "trend": TREND_VALUE.get(trend or "", 0.0),
        "upstream": STATUS_VALUE.get(upstream_status or "", 0.0),
        "rain": min(max((rain_next_3h_mm or 0.0) / RAIN_FULL_MM, 0.0), 1.0),
    }
    score = round(sum(WEIGHTS[name] * value for name, value in components.items()), 3)
    level = next((name for upper, name in LEVEL_UPPER_BOUNDS if score < upper), TOP_LEVEL)
    return Risk(
        score=score,
        level=level,
        components={
            **{name: round(value, 3) for name, value in components.items()},
            "weights": WEIGHTS,
            "inputs": {
                "status": status,
                "trend": trend,
                "upstream_status": upstream_status,
                "rain_next_3h_mm": rain_next_3h_mm,
            },
        },
    )
