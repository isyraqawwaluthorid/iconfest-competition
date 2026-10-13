"""Penghalusan status air: jawaban AI per frame diubah menjadi status terkonfirmasi lewat aturan.

Status resmi tidak pernah diambil langsung dari satu jawaban AI. Naik butuh dua pembacaan yang
sepakat; turun butuh tiga (lebih baik terlambat menyatakan aman daripada terlalu cepat).
"""

from __future__ import annotations

from dataclasses import dataclass

LEVELS = ("normal", "waspada", "siaga", "awas")
ROAD_FLOOD_LEVEL = {"tidak_tergenang": 0, "genangan_ringan": 1, "genangan_sedang": 2, "genangan_tinggi": 3}
NOT_HIGHER_THAN_REFERENCE = {"sama", "lebih_rendah"}
MIN_CONFIDENCE = 0.5
# Pembacaan di atas normal butuh keyakinan lebih tinggi. Busa pompa dan pantulan malam hampir selalu
# dinilai naik dengan keyakinan 0,48-0,62; pembacaan seperti itu menandai "perlu diperiksa", bukan menaikkan status.
MIN_CONFIDENCE_ELEVATED = 0.65
READINGS_TO_RISE = 2
READINGS_TO_FALL = 3
# Sampah: penilaian AI atas sampah yang sama sering berganti antara "sedikit" dan "banyak" dari satu gambar ke
# gambar berikutnya (Manggis-IN: 12 kali dalam 46 penilaian, 13 Okt 2026). "Banyak" baru resmi bila 4 dari 6
# penilaian terakhir yang layak sepakat (sekitar 2-3 jam), dan baru lepas bila tinggal 1 dari 6. Diuji pada
# penilaian 72 jam: dengan 3 dari 4, status "banyak" menyala 11 kali di empat lokasi; dengan 4 dari 6, 7 kali.
TRASH_HEAVY = "banyak"
TRASH_LEVELS = ("tidak_terlihat", "sedikit", TRASH_HEAVY)
TRASH_NOT_APPLICABLE = "tidak_relevan"
TRASH_WINDOW = 6
TRASH_TO_CONFIRM = 4
TRASH_TO_KEEP = 2


@dataclass(frozen=True)
class Reading:
    """Satu pembacaan AI yang relevan untuk penghalusan."""

    status: str
    road_flood: str
    confidence: float
    quality: str | None
    change_vs_reference: str | None = None
    trash: str | None = None


def level_of(reading: Reading, water_kind: str | None) -> int | None:
    """Level 0..3 dari satu pembacaan, atau None jika pembacaan itu tidak layak dipakai."""
    if reading.confidence < MIN_CONFIDENCE or reading.quality == "poor":
        return None
    if water_kind == "jalan":
        level = ROAD_FLOOD_LEVEL.get(reading.road_flood)
    else:
        level = LEVELS.index(reading.status) if reading.status in LEVELS else None
    if level and reading.confidence < MIN_CONFIDENCE_ELEVATED:
        return None
    if level and reading.change_vs_reference in NOT_HIGHER_THAN_REFERENCE:
        # Jawaban yang bertentangan dengan dirinya sendiri: status di atas normal (atau jalan
        # tergenang), tetapi kondisinya dinilai sama dengan foto referensi normal. Tidak dipakai.
        return None
    return level


def confirm_water_status(current: str | None, readings: list[Reading], water_kind: str | None) -> tuple[str | None, bool]:
    """Status terkonfirmasi yang baru dan tanda `needs_verification`.

    `readings` terurut dari yang terbaru. `needs_verification` menyala jika pembacaan terbaru
    tidak layak dipakai (keyakinan rendah, gambar buruk, atau tidak dapat dinilai).
    """
    if not readings:
        return current, False
    needs_verification = level_of(readings[0], water_kind) is None
    valid = [lvl for lvl in (level_of(r, water_kind) for r in readings) if lvl is not None]
    if not valid:
        return current, needs_verification

    if current is None:
        # Belum ada status: dua pembacaan sepakat, atau satu pembacaan "normal" (keadaan paling umum).
        if len(valid) >= READINGS_TO_RISE:
            return LEVELS[min(valid[:READINGS_TO_RISE])], needs_verification
        return (LEVELS[0] if valid[0] == 0 else None), needs_verification

    now = LEVELS.index(current)
    rising = valid[:READINGS_TO_RISE]
    if len(rising) == READINGS_TO_RISE and min(rising) > now:
        return LEVELS[min(rising)], needs_verification
    falling = valid[:READINGS_TO_FALL]
    if len(falling) == READINGS_TO_FALL and max(falling) < now:
        return LEVELS[max(falling)], needs_verification
    return current, needs_verification


def confirm_trash(current: str | None, readings: list[Reading]) -> str | None:
    """Status sampah resmi dari penilaian terbaru (`readings` terurut dari yang terbaru).

    Penilaian berkeyakinan rendah, dari gambar buruk, atau yang tidak bisa menilai sampah tidak ikut dihitung.
    Tanpa penilaian yang layak, status sebelumnya dipertahankan.
    """
    if readings and readings[0].trash == TRASH_NOT_APPLICABLE:
        return TRASH_NOT_APPLICABLE
    usable = [r.trash for r in readings if r.trash in TRASH_LEVELS and r.confidence >= MIN_CONFIDENCE and r.quality != "poor"]
    window = usable[:TRASH_WINDOW]
    if not window:
        return current
    heavy = window.count(TRASH_HEAVY)
    if heavy >= TRASH_TO_CONFIRM or (current == TRASH_HEAVY and heavy >= TRASH_TO_KEEP):
        return TRASH_HEAVY
    lighter = [level for level in window if level != TRASH_HEAVY]
    if not lighter:
        # Baru beberapa penilaian, semuanya "banyak": sampah terlihat, tetapi belum cukup untuk disebut banyak.
        return current if current in TRASH_LEVELS[:2] else "sedikit"
    return max(lighter, key=lambda level: (lighter.count(level), -lighter.index(level)))
