import { DISTRICTS, districtOf, type District } from "./geo/districts";
import { DENSITY, isElevated, isOnline, RISK, trashDisplay, UNTRACKED, type StatusDisplay, type Tone } from "./status";
import type { CameraOverview, DensityLevel, GridWeather, RiskLevel, TrashLevel } from "./types";

/**
 * Ringkasan per kecamatan untuk peta tematik. Kamera hanya sumber data; yang ditampilkan adalah
 * kondisi wilayahnya. Wilayah tanpa sumber data ditandai "tidak terpantau", bukan dianggap aman.
 */

export type Theme = "risk" | "traffic" | "rain" | "trash";

export const THEMES: { id: Theme; label: string; explain: string }[] = [
  {
    id: "risk",
    label: "Risiko air",
    explain: "Warna mengikuti lokasi air dengan skor risiko tertinggi di tiap kecamatan.",
  },
  {
    id: "traffic",
    label: "Kepadatan lalu lintas",
    explain: "Median indeks kepadatan relatif kamera lalu lintas di tiap kecamatan, dibanding jam yang sama di hari-hari sebelumnya.",
  },
  {
    id: "rain",
    label: "Hujan 3 jam ke depan",
    explain: "Prakiraan Open-Meteo dari titik cuaca terdekat ke tiap kecamatan.",
  },
  {
    id: "trash",
    label: "Sampah perairan",
    explain: "Tingkat sampah tertinggi di lokasi air tiap kecamatan, dinilai AI dari gambar kamera. Bukan ukuran berat atau volume.",
  },
];

const TRASH_RANK: TrashLevel[] = ["tidak_terlihat", "sedikit", "banyak"];

/** Lokasi air yang sampahnya dinilai (pompa, sungai, kolam; bukan jalan) dan punya status sampah resmi. */
export function hasTrashStatus(camera: CameraOverview): boolean {
  return hasWaterStatus(camera) && camera.trash != null && TRASH_RANK.includes(camera.trash);
}

/** Lokasi yang status sampah resminya "banyak". */
export function trashHeavySites(cameras: CameraOverview[]): CameraOverview[] {
  return cameras.filter((camera) => hasTrashStatus(camera) && camera.trash === "banyak");
}

export type DistrictSummary = {
  district: District;
  cameras: CameraOverview[];
  online: number;
  /** Lokasi air yang sudah punya status terkonfirmasi. */
  waterSites: CameraOverview[];
  worstWater: CameraOverview | null;
  elevated: number;
  /** Kamera lalu lintas yang sedang hidup dan punya indeks kepadatan. */
  trafficSites: CameraOverview[];
  densityIndex: number | null;
  densityLevel: DensityLevel;
  busy: number;
  rain: GridWeather | null;
  /** Tingkat sampah tertinggi di antara lokasi air kecamatan ini; `null` bila tidak ada lokasi yang dinilai sampahnya. */
  worstTrash: TrashLevel | null;
};

// Batas yang sama dengan worker (fusion/baseline.py), agar wilayah dan kamera memakai skala yang sama.
const DENSITY_UPPER_BOUNDS: [number, DensityLevel][] = [
  [0.8, "lancar"],
  [1.3, "normal"],
  [1.8, "ramai"],
];

export function densityLevelOf(index: number | null): DensityLevel {
  if (index == null) return "tidak_diketahui";
  return DENSITY_UPPER_BOUNDS.find(([upper]) => index < upper)?.[1] ?? "padat";
}

const RAIN_STEPS: { upTo: number; label: string; tone: Tone }[] = [
  { upTo: 1, label: "Tidak hujan (< 1 mm)", tone: "rain-0" },
  { upTo: 5, label: "Ringan (1–5 mm)", tone: "rain-1" },
  { upTo: 10, label: "Sedang (5–10 mm)", tone: "rain-2" },
  { upTo: 20, label: "Lebat (10–20 mm)", tone: "rain-3" },
  { upTo: Infinity, label: "Sangat lebat (≥ 20 mm)", tone: "rain-4" },
];

export function rainDisplay(mm: number): StatusDisplay {
  const step = RAIN_STEPS.find((s) => mm < s.upTo) ?? RAIN_STEPS[RAIN_STEPS.length - 1];
  return { label: step.label, tone: step.tone };
}

/** Angka dengan koma desimal, sesuai penulisan Indonesia. */
export function formatNumber(value: number, digits: number): string {
  return value.toFixed(digits).replace(".", ",");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function nearestGrid(district: District, weather: GridWeather[]): GridWeather | null {
  let best: GridWeather | null = null;
  let bestDistance = Infinity;
  for (const grid of weather) {
    const distance = (grid.lat - district.center[0]) ** 2 + (grid.lng - district.center[1]) ** 2;
    if (distance < bestDistance) [best, bestDistance] = [grid, distance];
  }
  return best;
}

export function hasWaterStatus(camera: CameraOverview): boolean {
  return camera.water_status != null && camera.water_status !== "tidak_dapat_dinilai";
}

/** Keterangan pembanding kepadatan; menyebut terus terang bila pembandingnya masih dari kurang dari tiga hari. */
export function densityNote(cameras: CameraOverview[]): string {
  const base = "Indeks kepadatan relatif: jumlah kendaraan pada gambar terakhir dibanding titik itu sendiri pada jam yang sama di hari-hari sebelumnya.";
  return cameras.some((cam) => cam.baseline_is_provisional)
    ? `${base} Pembanding masih sementara (kurang dari tiga hari data), jadi hari yang sekadar lebih ramai bisa terbaca padat.`
    : base;
}

export function hasDensity(camera: CameraOverview): boolean {
  return camera.modules.includes("traffic") && isOnline(camera) && camera.density_index != null;
}

export function summarizeDistricts(cameras: CameraOverview[], weather: GridWeather[]): DistrictSummary[] {
  const byDistrict = new Map<string, CameraOverview[]>();
  for (const camera of cameras) {
    const name = districtOf(camera.lat, camera.lng);
    if (name) byDistrict.set(name, [...(byDistrict.get(name) ?? []), camera]);
  }
  return DISTRICTS.map((district) => {
    const members = byDistrict.get(district.name) ?? [];
    const waterSites = members.filter(hasWaterStatus);
    const trafficSites = members.filter(hasDensity);
    const worstWater = waterSites.reduce<CameraOverview | null>(
      (worst, cam) => (worst === null || (cam.risk_score ?? -1) > (worst.risk_score ?? -1) ? cam : worst),
      null,
    );
    const densityIndex = median(trafficSites.map((cam) => cam.density_index as number));
    return {
      district,
      cameras: members,
      online: members.filter(isOnline).length,
      waterSites,
      worstWater,
      elevated: waterSites.filter((cam) => isElevated(cam.water_status)).length,
      trafficSites,
      densityIndex,
      densityLevel: densityLevelOf(densityIndex),
      busy: trafficSites.filter((cam) => cam.density_level === "ramai" || cam.density_level === "padat").length,
      rain: nearestGrid(district, weather),
      worstTrash: members
        .filter(hasTrashStatus)
        .reduce<TrashLevel | null>(
          (worst, cam) => (worst === null || TRASH_RANK.indexOf(cam.trash as TrashLevel) > TRASH_RANK.indexOf(worst) ? cam.trash : worst),
          null,
        ),
    };
  });
}

/** Warna dan label satu kecamatan untuk tema yang dipilih. */
export function themeDisplay(summary: DistrictSummary, theme: Theme): StatusDisplay {
  if (theme === "risk") {
    const level: RiskLevel | null = summary.worstWater?.risk_level ?? null;
    return level ? RISK[level] : UNTRACKED;
  }
  if (theme === "traffic") {
    return summary.densityIndex == null ? UNTRACKED : DENSITY[summary.densityLevel];
  }
  if (theme === "trash") return trashDisplay(summary.worstTrash) ?? UNTRACKED;
  return summary.rain ? rainDisplay(summary.rain.precip_next_3h_mm) : UNTRACKED;
}

export function themeLegend(theme: Theme): StatusDisplay[] {
  if (theme === "risk") return [RISK.rendah, RISK.sedang, RISK.tinggi, RISK.sangat_tinggi, UNTRACKED];
  if (theme === "traffic") return [DENSITY.lancar, DENSITY.normal, DENSITY.ramai, DENSITY.padat, UNTRACKED];
  if (theme === "trash") return [...TRASH_RANK.map((level) => trashDisplay(level) as StatusDisplay), UNTRACKED];
  return [...RAIN_STEPS.map(({ label, tone }) => ({ label, tone })), UNTRACKED];
}

/** Kamera yang menjadi sumber data sebuah tema, untuk digambar sebagai titik kecil di peta. */
export function themeSources(cameras: CameraOverview[], theme: Theme): CameraOverview[] {
  if (theme === "risk") return cameras.filter(hasWaterStatus);
  if (theme === "traffic") return cameras.filter(hasDensity);
  if (theme === "trash") return cameras.filter(hasTrashStatus);
  return [];
}

function wettestGrid(weather: GridWeather[]): GridWeather | null {
  return weather.reduce<GridWeather | null>(
    (max, grid) => (max === null || grid.precip_next_3h_mm > max.precip_next_3h_mm ? grid : max),
    null,
  );
}

export type CityStat = { id: "water" | "rain" | "traffic" | "coverage"; label: string; value: string; unit: string; hint: string; tone: Tone };

/** Empat angka utama kota: satu angka per pertanyaan, dengan keterangan singkat di bawahnya. */
export function cityStats(cameras: CameraOverview[], weather: GridWeather[], summaries: DistrictSummary[]): CityStat[] {
  const waterSites = cameras.filter(hasWaterStatus);
  const elevated = waterSites.filter((cam) => isElevated(cam.water_status));
  const trafficSites = cameras.filter(hasDensity);
  const busy = trafficSites.filter((cam) => cam.density_level === "ramai" || cam.density_level === "padat");
  const wettest = wettestGrid(weather);
  const tracked = summaries.filter((s) => s.waterSites.length > 0).length;
  const rainMm = wettest?.precip_next_3h_mm ?? null;
  return [
    {
      id: "water",
      label: "Lokasi air waspada ke atas",
      value: waterSites.length > 0 ? String(elevated.length) : "–",
      unit: waterSites.length > 0 ? `/ ${waterSites.length} lokasi` : "",
      hint: waterSites.length === 0 ? "Belum ada lokasi yang dinilai" : elevated.length === 0 ? "Semua lokasi normal" : listNames(elevated.map((c) => c.name), 2),
      tone: elevated.length > 0 ? "waspada" : "normal",
    },
    {
      id: "rain",
      label: "Hujan 3 jam ke depan",
      value: rainMm == null ? "–" : formatNumber(rainMm, 1),
      unit: rainMm == null ? "" : "mm",
      hint: wettest ? `Tertinggi di ${wettest.name}` : "Data hujan belum tersedia",
      tone: rainMm != null && rainMm >= 10 ? "waspada" : "normal",
    },
    {
      id: "traffic",
      label: "Titik lebih padat dari biasanya",
      value: trafficSites.length > 0 ? String(busy.length) : "–",
      unit: trafficSites.length > 0 ? `/ ${trafficSites.length} titik` : "",
      hint: trafficSites.some((cam) => cam.baseline_is_provisional)
        ? "Dibanding jam yang sama di hari sebelumnya; pembanding masih sementara"
        : "Dibanding jam yang sama di hari-hari sebelumnya",
      tone: "density-normal",
    },
    {
      id: "coverage",
      label: "Kecamatan dengan lokasi air terpantau",
      value: String(tracked),
      unit: `/ ${summaries.length} kecamatan`,
      hint: tracked < summaries.length ? `${summaries.length - tracked} kecamatan belum terpantau` : "Semua kecamatan terpantau",
      tone: "unknown",
    },
  ];
}

export type CitySituation = {
  tone: Tone;
  headline: string;
  points: string[];
};

function listNames(names: string[], max = 3): string {
  const shown = names.slice(0, max).join(", ");
  return names.length > max ? `${shown}, dan ${names.length - max} lainnya` : shown;
}

/** Kalimat ringkas kondisi kota, disusun dari aturan (bukan LLM) agar selalu tersedia dan konsisten. */
export function citySituation(cameras: CameraOverview[], weather: GridWeather[]): CitySituation {
  const waterSites = cameras.filter(hasWaterStatus);
  const elevated = waterSites.filter((cam) => isElevated(cam.water_status));
  const rising = waterSites.filter((cam) => cam.water_trend === "naik" || cam.water_trend === "naik_cepat");
  const wettest = wettestGrid(weather);

  const points: string[] = [];
  if (waterSites.length === 0) {
    points.push("Belum ada lokasi air yang dinilai.");
  } else if (elevated.length === 0) {
    points.push(`Semua ${waterSites.length} lokasi air yang dipantau berstatus normal.`);
  } else {
    points.push(
      `${elevated.length} dari ${waterSites.length} lokasi air berstatus waspada ke atas: ${listNames(elevated.map((c) => c.name))}.`,
    );
  }
  if (rising.length > 0) points.push(`Muka air sedang naik di ${listNames(rising.map((c) => c.name))}.`);

  if (!wettest) {
    points.push("Data hujan belum tersedia.");
  } else if (wettest.precip_next_3h_mm >= 10) {
    points.push(`Hujan lebat diprakirakan: hingga ${formatNumber(wettest.precip_next_3h_mm, 1)} mm dalam 3 jam ke depan di ${wettest.name}.`);
  } else if (wettest.precip_next_3h_mm >= 1) {
    points.push(`Hujan ringan diprakirakan dalam 3 jam ke depan, paling banyak ${formatNumber(wettest.precip_next_3h_mm, 1)} mm di ${wettest.name}.`);
  } else {
    points.push("Tidak ada hujan berarti yang diprakirakan dalam 3 jam ke depan.");
  }

  const worst = elevated.some((c) => c.water_status === "awas")
    ? "awas"
    : elevated.some((c) => c.water_status === "siaga")
      ? "siaga"
      : elevated.length > 0 || (wettest?.precip_next_3h_mm ?? 0) >= 10
        ? "waspada"
        : "normal";
  const headline: Record<typeof worst, string> = {
    awas: "Ada lokasi air berstatus awas",
    siaga: "Ada lokasi air berstatus siaga",
    waspada: "Perlu perhatian",
    normal: "Kondisi kota terpantau normal",
  };
  return { tone: worst, headline: headline[worst], points };
}
