import type {
  AlertLevel,
  CameraModule,
  CameraOverview,
  DensityLevel,
  Health,
  RiskLevel,
  TrashLevel,
  WaterStatus,
  WaterTrend,
} from "./types";

/**
 * Satu sumber untuk label dan warna status. `tone` adalah nama token warna di globals.css
 * (dipakai sebagai kelas `tone-*` pada penanda peta dan badge).
 */
export type Tone =
  | "normal"
  | "waspada"
  | "siaga"
  | "awas"
  | "unknown"
  | "offline"
  | "density-lancar"
  | "density-normal"
  | "density-ramai"
  | "density-padat"
  | "untracked"
  | "rain-0"
  | "rain-1"
  | "rain-2"
  | "rain-3"
  | "rain-4";

export type StatusDisplay = { label: string; tone: Tone };

export const HEALTH: Record<Health, StatusDisplay> = {
  live: { label: "Aktif", tone: "normal" },
  frozen: { label: "Gambar beku", tone: "offline" },
  dead: { label: "Offline", tone: "offline" },
  unknown: { label: "Belum diperiksa", tone: "unknown" },
};

export const DENSITY: Record<DensityLevel, StatusDisplay> = {
  lancar: { label: "Lancar", tone: "density-lancar" },
  normal: { label: "Normal", tone: "density-normal" },
  ramai: { label: "Ramai", tone: "density-ramai" },
  padat: { label: "Padat", tone: "density-padat" },
  tidak_diketahui: { label: "Belum ada pembanding", tone: "unknown" },
};

export const WATER: Record<WaterStatus, StatusDisplay> = {
  normal: { label: "Normal", tone: "normal" },
  waspada: { label: "Waspada", tone: "waspada" },
  siaga: { label: "Siaga", tone: "siaga" },
  awas: { label: "Awas", tone: "awas" },
  tidak_dapat_dinilai: { label: "Tidak dapat dinilai", tone: "unknown" },
};

/** Tingkat risiko memakai warna yang sama dengan status air agar skala bahayanya konsisten. */
export const RISK: Record<RiskLevel, StatusDisplay> = {
  rendah: { label: "Risiko rendah", tone: "normal" },
  sedang: { label: "Risiko sedang", tone: "waspada" },
  tinggi: { label: "Risiko tinggi", tone: "siaga" },
  sangat_tinggi: { label: "Risiko sangat tinggi", tone: "awas" },
  tidak_diketahui: { label: "Risiko belum diketahui", tone: "unknown" },
};

export const ALERT: Record<AlertLevel, StatusDisplay> = {
  info: { label: "Info", tone: "density-normal" },
  waspada: { label: "Waspada", tone: "waspada" },
  siaga: { label: "Siaga", tone: "siaga" },
  awas: { label: "Awas", tone: "awas" },
};

export const TREND_LABEL: Record<WaterTrend, string> = {
  naik_cepat: "naik cepat",
  naik: "naik",
  stabil: "stabil",
  turun: "turun",
  tidak_diketahui: "tren belum diketahui",
};

/** Wilayah tanpa sumber data untuk tema yang sedang dilihat. */
export const UNTRACKED: StatusDisplay = { label: "Tidak terpantau", tone: "untracked" };

export const NOT_ASSESSED: StatusDisplay = { label: "Belum dinilai", tone: "unknown" };

export const TRASH_LABEL: Record<TrashLevel, string> = {
  tidak_terlihat: "Tidak terlihat",
  sedikit: "Sedikit",
  banyak: "Banyak",
  tidak_dapat_dinilai: "Tidak dapat dinilai",
  tidak_relevan: "Tidak relevan",
};

/**
 * Tingkat sampah di perairan (status resmi yang sudah dihaluskan worker). Hanya tiga tingkat yang berwarna;
 * `null` untuk lokasi yang sampahnya tidak dinilai (jalan) atau belum bisa dinilai.
 */
export function trashDisplay(trash: TrashLevel | null): StatusDisplay | null {
  if (trash === "tidak_terlihat") return { label: "Tidak terlihat", tone: "normal" };
  if (trash === "sedikit") return { label: "Sedikit", tone: "waspada" };
  if (trash === "banyak") return { label: "Banyak", tone: "siaga" };
  return null;
}

/** Keyakinan AI ditulis sebagai kata lebih dulu; angkanya hanya pelengkap. */
export function confidenceLabel(confidence: number | null): string {
  if (confidence == null) return "tidak diketahui";
  const word = confidence >= 0.75 ? "tinggi" : confidence >= 0.5 ? "sedang" : "rendah";
  return `${word} (${confidence.toFixed(2).replace(".", ",")})`;
}

export function isElevated(status: WaterStatus | null): boolean {
  return status === "waspada" || status === "siaga" || status === "awas";
}

/** Kelas Tailwind latar per tone, ditulis lengkap agar terbaca oleh pemindai Tailwind. */
export const TONE_BG: Record<Tone, string> = {
  normal: "bg-status-normal",
  waspada: "bg-status-waspada",
  siaga: "bg-status-siaga",
  awas: "bg-status-awas",
  unknown: "bg-status-unknown",
  offline: "bg-status-offline",
  "density-lancar": "bg-density-lancar",
  "density-normal": "bg-density-normal",
  "density-ramai": "bg-density-ramai",
  "density-padat": "bg-density-padat",
  untracked: "bg-untracked",
  "rain-0": "bg-rain-0",
  "rain-1": "bg-rain-1",
  "rain-2": "bg-rain-2",
  "rain-3": "bg-rain-3",
  "rain-4": "bg-rain-4",
};

export type MapLayer = "health" | "traffic" | "crowd" | "water";

export const MAP_LAYERS: { id: MapLayer; label: string; module: CameraModule | null }[] = [
  { id: "health", label: "Kesehatan Kamera", module: null },
  { id: "traffic", label: "Lalu Lintas", module: "traffic" },
  { id: "water", label: "Air", module: "water" },
  { id: "crowd", label: "Ruang Publik", module: "crowd" },
];

export function healthOf(camera: Pick<CameraOverview, "health">): StatusDisplay {
  return HEALTH[camera.health ?? "unknown"];
}

export function isOnline(camera: Pick<CameraOverview, "health">): boolean {
  return camera.health === "live";
}

/** Status yang ditampilkan untuk satu kamera pada lapisan peta tertentu. */
export function displayFor(camera: CameraOverview, layer: MapLayer): StatusDisplay {
  if (layer === "health" || !isOnline(camera)) return healthOf(camera);
  if (layer === "water") return camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED;
  return DENSITY[camera.density_level ?? "tidak_diketahui"];
}

/** Daftar legenda untuk satu lapisan peta. */
export function legendFor(layer: MapLayer): StatusDisplay[] {
  const offline = HEALTH.dead;
  if (layer === "health") return [HEALTH.live, { ...offline, label: "Offline / gambar beku" }, HEALTH.unknown];
  if (layer === "water") return [WATER.normal, WATER.waspada, WATER.siaga, WATER.awas, NOT_ASSESSED, offline];
  return [DENSITY.lancar, DENSITY.normal, DENSITY.ramai, DENSITY.padat, DENSITY.tidak_diketahui, offline];
}
