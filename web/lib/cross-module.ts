import { hasDensity } from "./insight";
import { isElevated } from "./status";
import type { CameraOverview } from "./types";

/**
 * Lintas modul (genangan → lalu lintas): keadaan titik lalu lintas di sekitar lokasi air yang statusnya naik.
 * Aturannya sama dengan worker (`fusion/cross_module.py`): radius 1 km, minimal dua titik hidup yang punya
 * indeks. Yang ditampilkan adalah hal yang terjadi bersamaan, bukan sebab-akibat.
 */
export const NEARBY_RADIUS_M = 1000;
const MIN_CAMERAS = 2;
const EARTH_M = 6_371_000;
const FLOODED = ["genangan_ringan", "genangan_sedang", "genangan_tinggi"];

export type NearbyTraffic = {
  cameras: number;
  /** Titik yang sedang ramai atau padat dibanding kebiasaannya. */
  busy: number;
  busiest: CameraOverview;
  /** Ada pembanding yang masih sementara: belum layak disimpulkan. */
  provisional: boolean;
};

/** Bentuk yang disimpan worker pada kejadian (`events.traffic_impact`). */
export type TrafficImpact = {
  radius_m: number;
  cameras: number;
  busier_than_usual: number;
  median_index: number;
  busiest: { camera_id: string; name: string; density_index: number; level: string };
  baseline: "per_jam" | "sementara";
};

/** Lokasi air yang status resminya di atas normal, atau jalan yang tergenang. */
export function isRaisedSite(site: CameraOverview): boolean {
  return isElevated(site.water_status) || FLOODED.includes(site.road_flood ?? "");
}

function distanceM(a: CameraOverview, b: CameraOverview): number {
  const rad = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(((b.lng - a.lng) * rad) / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

export function nearbyTraffic(site: CameraOverview, cameras: CameraOverview[]): NearbyTraffic | null {
  const near = cameras.filter((camera) => hasDensity(camera) && distanceM(site, camera) <= NEARBY_RADIUS_M);
  if (near.length < MIN_CAMERAS) return null;
  return {
    cameras: near.length,
    busy: near.filter((camera) => camera.density_level === "ramai" || camera.density_level === "padat").length,
    busiest: near.reduce((top, camera) => ((camera.density_index ?? 0) > (top.density_index ?? 0) ? camera : top)),
    provisional: near.some((camera) => camera.baseline_is_provisional),
  };
}

/** Kalimat ringkas untuk keadaan lalu lintas di sekitar sebuah lokasi; dipakai panel kecamatan dan halaman Riwayat. */
export function nearbySentence(cameras: number, busy: number, busiestName: string, provisional: boolean): string {
  const base =
    busy === 0
      ? `Lalu lintas di sekitarnya (1 km): tidak ada dari ${cameras} titik yang lebih padat dari biasanya.`
      : `Lalu lintas di sekitarnya (1 km): ${busy} dari ${cameras} titik lebih padat dari biasanya, terpadat di ${busiestName}.`;
  return provisional ? `${base} Pembanding masih sementara, jadi belum bisa disimpulkan.` : base;
}
