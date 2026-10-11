import type { CameraModule, CameraOverview, DensityLevel, Health, TrashLevel, WaterStatus } from "./types";

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
  | "density-padat";

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

export const NOT_ASSESSED: StatusDisplay = { label: "Belum dinilai", tone: "unknown" };

export const TRASH_LABEL: Record<TrashLevel, string> = {
  tidak_terlihat: "Tidak terlihat",
  sedikit: "Sedikit",
  banyak: "Banyak",
  tidak_dapat_dinilai: "Tidak dapat dinilai",
  tidak_relevan: "Tidak relevan",
};

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
