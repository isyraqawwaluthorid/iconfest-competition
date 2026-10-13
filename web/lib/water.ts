import type { SiteProgress } from "./progress";
import { HEALTH, isElevated, isOnline, NOT_ASSESSED, WATER, type StatusDisplay, type Tone } from "./status";
import type { CameraOverview, GridWeather, WaterStatus } from "./types";

/**
 * Halaman Air: satu baris per lokasi air yang sudah dikalibrasi. Status yang ditampilkan adalah status resmi
 * (dua penilaian AI yang sepakat), bukan penilaian tunggal; penilaian tunggal yang naik tampil sebagai indikasi awal.
 */
export type WaterRow = {
  camera: CameraOverview;
  status: StatusDisplay;
  /** Sudah punya status resmi yang bisa dinilai (bukan "belum dinilai" dan bukan "tidak dapat dinilai"). */
  assessed: boolean;
  /** Level penilaian AI terakhir bila lebih tinggi dari status resmi dan belum dikonfirmasi. */
  pending: WaterStatus | null;
};

const RANK: Record<WaterStatus, number> = { awas: 3, siaga: 2, waspada: 1, normal: 0, tidak_dapat_dinilai: 0 };
const LEVELS: WaterStatus[] = ["normal", "waspada", "siaga", "awas"];

/** Lokasi yang paling perlu diperhatikan lebih dulu: status naik, lalu indikasi awal, lalu skor risiko. */
export function waterRows(cameras: CameraOverview[], progress: ReadonlyMap<string, SiteProgress>): WaterRow[] {
  const rows = cameras
    .filter((camera) => camera.modules.includes("water") && camera.is_calibrated)
    .map((camera): WaterRow => {
      const assessed = camera.water_status != null && camera.water_status !== "tidak_dapat_dinilai";
      return {
        camera,
        status: !isOnline(camera) && !assessed ? HEALTH.dead : camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED,
        assessed,
        pending: progress.get(camera.id)?.pending ?? null,
      };
    });
  const weight = (row: WaterRow) => RANK[row.camera.water_status ?? "normal"] * 10 + (row.pending ? RANK[row.pending] + 1 : 0);
  return rows.sort(
    (a, b) =>
      weight(b) - weight(a) ||
      Number(b.assessed) - Number(a.assessed) ||
      (b.camera.risk_score ?? 0) - (a.camera.risk_score ?? 0) ||
      a.camera.name.localeCompare(b.camera.name),
  );
}

export type WaterSituation = {
  tone: Tone;
  headline: string;
  detail: string;
  counts: { level: WaterStatus; status: StatusDisplay; count: number }[];
  assessed: number;
  unassessed: number;
  pending: number;
};

/** Kalimat ringkas kondisi air, disusun dari aturan agar selalu tersedia dan konsisten. */
export function waterSituation(rows: WaterRow[]): WaterSituation {
  const assessed = rows.filter((row) => row.assessed);
  const counts = LEVELS.map((level) => ({ level, status: WATER[level], count: assessed.filter((row) => row.camera.water_status === level).length }));
  const raised = assessed.filter((row) => isElevated(row.camera.water_status));
  const pending = rows.filter((row) => row.pending).length;
  const base = { counts, assessed: assessed.length, unassessed: rows.length - assessed.length, pending };
  if (assessed.length === 0) {
    return { ...base, tone: "unknown", headline: "Belum ada lokasi air yang dinilai", detail: "Penilaian pertama muncul setelah kamera aktif dan dikalibrasi." };
  }
  if (raised.length === 0) {
    return {
      ...base,
      tone: pending > 0 ? "waspada" : "normal",
      headline: pending > 0 ? `${pending} lokasi menunggu penilaian kedua` : `Semua ${assessed.length} lokasi air normal`,
      detail:
        pending > 0
          ? "AI baru sekali menilai naik. Status resmi belum berubah sampai penilaian berikutnya sepakat."
          : "Tidak ada lokasi yang status resminya di atas normal.",
    };
  }
  const worst = raised.reduce((top, row) => (RANK[row.camera.water_status as WaterStatus] > RANK[top.camera.water_status as WaterStatus] ? row : top));
  return {
    ...base,
    tone: WATER[worst.camera.water_status as WaterStatus].tone,
    headline: `${raised.length} dari ${assessed.length} lokasi air di atas normal`,
    detail: `Tertinggi: ${worst.camera.name}, ${WATER[worst.camera.water_status as WaterStatus].label.toLowerCase()}. Yang lain: ${
      raised
        .filter((row) => row !== worst)
        .map((row) => row.camera.name)
        .join(", ") || "tidak ada"
    }.`,
  };
}

/** Satu pasangan hulu → hilir dari tabel `river_links`. */
export type RiverLink = {
  river_system: string;
  upstream_camera_id: string;
  downstream_camera_id: string;
  /** Jeda hulu → hilir dalam menit: yang dipelajari dari kejadian bila ada, kalau tidak perkiraan awal. */
  lag_minutes: number;
  learned: boolean;
};

/** Titik cuaca dengan prakiraan hujan 3 jam tertinggi, atau `null` bila data hujan belum ada. */
export function wettest(weather: GridWeather[]): GridWeather | null {
  return weather.reduce<GridWeather | null>((max, grid) => (max === null || grid.precip_next_3h_mm > max.precip_next_3h_mm ? grid : max), null);
}
