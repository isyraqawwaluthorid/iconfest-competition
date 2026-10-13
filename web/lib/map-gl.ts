import type { LatLng } from "./geo/districts";
import type { Tone } from "./status";

/**
 * Pembantu untuk peta 3D (MapLibre GL): warna dari token CSS, bentuk GeoJSON, dan pengecekan dukungan WebGL.
 * Peta 3D adalah tampilan bawaan; peta datar (Leaflet) dipakai otomatis bila browser tidak mendukung WebGL.
 */
export type Properties = Record<string, string | number | boolean | null>;
export type Collection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Properties>;

const TONE_VARIABLE: Record<Tone, string> = {
  normal: "--status-normal",
  waspada: "--status-waspada",
  siaga: "--status-siaga",
  awas: "--status-awas",
  unknown: "--status-unknown",
  offline: "--status-offline",
  "density-lancar": "--density-lancar",
  "density-normal": "--density-normal",
  "density-ramai": "--density-ramai",
  "density-padat": "--density-padat",
  untracked: "--untracked",
  "rain-0": "--rain-0",
  "rain-1": "--rain-1",
  "rain-2": "--rain-2",
  "rain-3": "--rain-3",
  "rain-4": "--rain-4",
};

/** Nilai satu token warna dari globals.css, supaya peta 3D dan bagian lain memakai warna yang sama. */
export function tokenColor(variable: string, fallback = "#8a93a6"): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(variable).trim() || fallback;
}

export function toneColor(tone: Tone): string {
  return tokenColor(TONE_VARIABLE[tone]);
}

/** Leaflet memakai [lintang, bujur]; GeoJSON memakai [bujur, lintang]. */
export const lngLat = (point: LatLng): [number, number] => [point[1], point[0]];
export const lngLats = (line: LatLng[]): [number, number][] => line.map(lngLat);

export function point(at: LatLng, properties: Properties): GeoJSON.Feature<GeoJSON.Point, Properties> {
  return { type: "Feature", geometry: { type: "Point", coordinates: lngLat(at) }, properties };
}

export function multiLine(lines: LatLng[][], properties: Properties): GeoJSON.Feature<GeoJSON.MultiLineString, Properties> {
  return { type: "Feature", geometry: { type: "MultiLineString", coordinates: lines.map(lngLats) }, properties };
}

/** `polygons`: poligon → cincin → titik, seperti yang dipakai `Polygon` Leaflet. */
export function multiPolygon(polygons: LatLng[][][], properties: Properties): GeoJSON.Feature<GeoJSON.MultiPolygon, Properties> {
  return { type: "Feature", geometry: { type: "MultiPolygon", coordinates: polygons.map((rings) => rings.map(lngLats)) }, properties };
}

export function collection(features: GeoJSON.Feature<GeoJSON.Geometry, Properties>[]): Collection {
  return { type: "FeatureCollection", features };
}

export function boundsOf(points: LatLng[]): [LatLng, LatLng] {
  return [
    [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))],
    [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))],
  ];
}

/** Kotak ±`meters` di sekitar satu titik, untuk mendekat ke satu lokasi. */
export function boundsAround(at: LatLng, meters: number): [LatLng, LatLng] {
  const dLat = meters / 110_540;
  const dLng = meters / (111_320 * Math.cos((at[0] * Math.PI) / 180));
  return [
    [at[0] - dLat, at[1] - dLng],
    [at[0] + dLat, at[1] + dLng],
  ];
}

let webgl: boolean | null = null;

/** Apakah browser ini bisa menggambar peta 3D. Diperiksa sekali; hanya dipanggil di browser. */
export function supportsWebGl(): boolean {
  if (typeof document === "undefined") return false;
  if (webgl === null) {
    try {
      const canvas = document.createElement("canvas");
      webgl = Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
    } catch {
      webgl = false;
    }
  }
  return webgl;
}
