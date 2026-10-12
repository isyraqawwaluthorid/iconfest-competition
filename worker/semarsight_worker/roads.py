"""Ruas jalan di sekitar kamera lalu lintas, dipotong dari geometri jalan OpenStreetMap.

Kamera hanya melihat jalan di dekatnya. Karena itu tiap kamera punya dua potongan: ruas dekat sepanjang
`REACH_M` ke tiap arah (yang kira-kira terlihat), dan perpanjangannya di jalan yang sama sampai `EXTENDED_M`
(perkiraan; digambar lebih tipis di peta). Jalan utama tanpa kamera tetap digambar, tanpa warna.
Modul ini murni geometri: tidak mengambil data dari jaringan dan tidak menyentuh database
(lihat `scripts/build_road_segments.py`).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

Point = tuple[float, float]  # (lat, lng)

REACH_M = 200.0  # panjang ruas ke tiap arah dari titik terdekat kamera: bagian yang kira-kira terlihat kamera
EXTENDED_M = 1000.0  # jalan yang sama diwarnai sampai sejauh ini sebagai perkiraan dari kamera itu
MIN_REACH_M = 60.0  # ruas tidak dipendekkan lebih dari ini walau kamera tetangganya sangat dekat
SAME_SPOT_M = 30.0  # kamera sedekat ini berada di tiang yang sama dan melihat ruas yang sama
MATCH_M = 60.0  # kamera dianggap berada di jalan yang jaraknya paling jauh sekian meter
FALLBACK_M = 120.0  # di atas MATCH_M sampai sini masih dipakai, tetapi ditandai untuk diperiksa
PARALLEL_M = 45.0  # jalur arah sebaliknya dari jalan yang sama (jalan dua jalur dipetakan sebagai dua garis)
HINT_M = 40.0  # di simpang, jalan yang namanya disebut pada nama kamera didahulukan bila sedekat ini
HINT_MIN_LETTERS = 5
GENERIC_WORDS = frozenset(
    {"jalan", "simpang", "bundaran", "counting", "camera", "terowongan", "jembatan", "patung", "pasar", "taman", "bawah"}
)
MAJOR = ("motorway", "trunk", "primary", "secondary", "tertiary")
EARTH_M = 6_371_000.0


@dataclass(frozen=True)
class Way:
    id: int
    name: str  # nama jalan; kosong jika tidak bernama di OpenStreetMap
    key: str  # penanda "jalan yang sama" untuk menyambung garis: nama, atau nomor ruas bila tak bernama
    highway: str
    nodes: tuple[int, ...]
    points: tuple[Point, ...]

    @property
    def road_class(self) -> str:
        return self.highway.removesuffix("_link")

    @property
    def is_major(self) -> bool:
        return self.road_class in MAJOR


@dataclass(frozen=True)
class Segment:
    road_name: str
    road_class: str
    distance_m: float  # jarak kamera ke jalan yang dipilih
    length_m: float  # panjang garis pertama
    lines: tuple[tuple[Point, ...], ...]

    @property
    def needs_review(self) -> bool:
        return self.distance_m > MATCH_M


def ways_from_overpass(elements: list[dict]) -> list[Way]:
    """Elemen `way` dari jawaban Overpass (`out body geom`) menjadi `Way`; yang tidak lengkap dilewati."""
    ways = []
    for element in elements:
        geometry, nodes = element.get("geometry") or [], element.get("nodes") or []
        if element.get("type") != "way" or len(geometry) < 2 or len(geometry) != len(nodes):
            continue
        tags = element.get("tags") or {}
        ways.append(
            Way(
                id=element["id"],
                name=tags.get("name", ""),
                key=tags.get("name") or tags.get("ref") or "",
                highway=tags.get("highway", ""),
                nodes=tuple(nodes),
                points=tuple((p["lat"], p["lon"]) for p in geometry),
            )
        )
    return ways


def network_lines(ways: list[Way]) -> list[tuple[Point, ...]]:
    """Garis semua jalan utama, untuk digambar sebagai latar jaringan jalan (termasuk yang tidak punya kamera)."""
    return [way.points for way in ways if way.is_major]


def _xy(point: Point, origin: Point) -> tuple[float, float]:
    """Meter dari `origin` (timur, utara); cukup teliti untuk jarak ratusan meter."""
    lat, lng = point
    x = math.radians(lng - origin[1]) * math.cos(math.radians(origin[0])) * EARTH_M
    return x, math.radians(lat - origin[0]) * EARTH_M


def distance_m(a: Point, b: Point) -> float:
    return math.hypot(*_xy(b, a))


def nearest_on_way(way: Way, camera: Point) -> tuple[float, int, float]:
    """Titik terdekat di `way` dari kamera: (jarak meter, indeks potongan, posisi 0..1 pada potongan itu)."""
    best = (math.inf, 0, 0.0)
    for index in range(len(way.points) - 1):
        ax, ay = _xy(way.points[index], camera)
        bx, by = _xy(way.points[index + 1], camera)
        dx, dy = bx - ax, by - ay
        length_sq = dx * dx + dy * dy
        t = 0.0 if length_sq == 0 else max(0.0, min(1.0, -(ax * dx + ay * dy) / length_sq))
        distance = math.hypot(ax + t * dx, ay + t * dy)
        if distance < best[0]:
            best = (distance, index, t)
    return best


def _letters(text: str) -> str:
    return "".join(ch for ch in text.lower() if ch.isalnum())


def name_hints(camera_name: str) -> tuple[str, ...]:
    """Kata pada nama kamera yang bisa menunjuk nama jalan ("PEMUDA - GAJAHMADA" → pemuda, gajahmada)."""
    words = "".join(ch if ch.isalnum() else " " for ch in camera_name.lower()).split()
    return tuple(w for w in words if len(w) >= HINT_MIN_LETTERS and w not in GENERIC_WORDS and not w.isdigit())


def pick_way(ways: list[Way], camera: Point, hints: tuple[str, ...] = ()) -> tuple[Way, float, int, float] | None:
    """Jalan yang diwakili kamera: jalan utama terdekat dalam `MATCH_M`, kalau tidak ada jalan apa pun yang terdekat.

    Di simpang beberapa jalan sama dekatnya; jalan yang namanya disebut pada nama kamera didahulukan.
    """
    located = [(way, *nearest_on_way(way, camera)) for way in ways]
    hinted = [item for item in located if item[1] <= HINT_M and any(hint in _letters(item[0].name) for hint in hints)]
    if hinted:
        return min(hinted, key=lambda item: (not item[0].is_major, item[1]))
    for limit, major_only in ((MATCH_M, True), (MATCH_M, False), (FALLBACK_M, True), (FALLBACK_M, False)):
        candidates = [item for item in located if item[1] <= limit and (item[0].is_major or not major_only)]
        if candidates:
            return min(candidates, key=lambda item: item[1])
    return None


def shared_reach(camera: Point, neighbours: list[Point], reach: float = REACH_M) -> float:
    """Jangkauan ruas bila ada kamera lain di jalan yang sama: berhenti di tengah antara keduanya, supaya ruas tidak bertumpuk."""
    gaps = [gap for gap in (distance_m(camera, other) for other in neighbours) if gap > SAME_SPOT_M]
    return max(MIN_REACH_M, min([reach, *(gap / 2 for gap in gaps)]))


def _between(a: Point, b: Point, t: float) -> Point:
    return a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t


def _turn(before: Point, at: Point, after: Point) -> float:
    """Besar belokan (radian) dari arah before→at ke arah at→after; 0 berarti lurus."""
    ax, ay = _xy(at, before)
    bx, by = _xy(after, at)
    return abs(math.atan2(ax * by - ay * bx, ax * bx + ay * by))


def _walk(way: Way, index: int, t: float, forward: bool, group: list[Way], used: set[int], reach: float) -> list[Point]:
    """Susuri jalan dari titik awal sejauh `reach` meter; di ujung garis, lanjut ke garis bernama sama yang paling lurus."""
    points = list(way.points) if forward else list(reversed(way.points))
    nodes = list(way.nodes) if forward else list(reversed(way.nodes))
    if not forward:
        index, t = len(points) - 2 - index, 1.0 - t
    path = [_between(points[index], points[index + 1], t)]
    cursor = index + 1
    left = reach
    while True:
        while cursor < len(points):
            step = distance_m(path[-1], points[cursor])
            if step >= left:
                path.append(_between(path[-1], points[cursor], left / step if step else 0.0))
                return path
            path.append(points[cursor])
            left -= step
            cursor += 1
        # Ujung garis: OpenStreetMap memotong satu jalan menjadi banyak garis yang bersambung di simpulnya.
        options = []
        for other in group:
            if other.id in used or len(path) < 2:
                continue
            if other.nodes[0] == nodes[-1]:
                options.append((_turn(path[-2], path[-1], other.points[1]), other, True))
            elif other.nodes[-1] == nodes[-1]:
                options.append((_turn(path[-2], path[-1], other.points[-2]), other, False))
        if not options:
            return path
        _, nxt, along = min(options, key=lambda option: option[0])
        used.add(nxt.id)
        points = list(nxt.points) if along else list(reversed(nxt.points))
        nodes = list(nxt.nodes) if along else list(reversed(nxt.nodes))
        cursor = 1


def _line(way: Way, index: int, t: float, group: list[Way], used: set[int], reach: float) -> tuple[Point, ...]:
    used.add(way.id)
    back = _walk(way, index, t, False, group, used, reach)
    ahead = _walk(way, index, t, True, group, used, reach)
    return tuple(reversed(back[1:])) + tuple(ahead)


def _length(line: tuple[Point, ...]) -> float:
    return sum(distance_m(a, b) for a, b in zip(line, line[1:]))


def segment_for(camera: Point, ways: list[Way], hints: tuple[str, ...] = (), reach: float = REACH_M) -> Segment | None:
    """Ruas yang diwakili satu kamera, atau `None` bila tidak ada jalan dalam `FALLBACK_M`."""
    picked = pick_way(ways, camera, hints)
    if picked is None:
        return None
    way, distance, index, t = picked
    # Jalan tanpa nama dan nomor ruas tidak disambung ke garis lain: tidak bisa dipastikan itu jalan yang sama.
    group = [other for other in ways if way.key and other.key == way.key]
    used: set[int] = set()
    lines = [_line(way, index, t, group, used, reach)]
    others = [(other, *nearest_on_way(other, camera)) for other in group if other.id not in used]
    others = [item for item in others if item[1] <= PARALLEL_M]
    if others:
        other, _, other_index, other_t = min(others, key=lambda item: item[1])
        lines.append(_line(other, other_index, other_t, group, used, reach))
    return Segment(
        road_name=way.name,
        road_class=way.road_class,
        distance_m=round(distance, 1),
        length_m=round(_length(lines[0]), 1),
        lines=tuple(lines),
    )
