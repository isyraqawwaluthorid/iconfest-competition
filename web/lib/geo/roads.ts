import type { LatLng } from "./districts";
import data from "./road-segments.json";

/**
 * Ruas jalan di sekitar tiap kamera lalu lintas, dipotong dari OpenStreetMap (© kontributor OpenStreetMap, ODbL)
 * oleh `worker/scripts/build_road_segments.py`. Kamera hanya melihat jalan di dekatnya: `lines` adalah bagian
 * yang kira-kira terlihat (paling jauh ±200 m ke tiap arah), `extended` adalah jalan yang sama sampai ±1 km,
 * yang diwarnai sebagai perkiraan dari kamera itu. Keduanya berhenti di tengah jarak ke kamera lain di jalan
 * yang sama. Jalan dua jalur punya dua garis.
 */
export type RoadSegment = {
  camera_id: string;
  /** Nama jalan di OpenStreetMap; kosong bila tidak bernama (misalnya bundaran). */
  road_name: string;
  road_class: string;
  length_m: number;
  lines: LatLng[][];
  /** Jalan yang sama, lebih jauh dari kamera: perkiraan, digambar lebih tipis. Memuat juga bagian `lines`. */
  extended: LatLng[][];
};

const segments = data.segments as unknown as RoadSegment[];

export const ROAD_SEGMENTS: ReadonlyMap<string, RoadSegment> = new Map(segments.map((segment) => [segment.camera_id, segment]));

/** Jangkauan ruas ke tiap arah dari kamera, dalam meter: bagian yang terlihat, dan perpanjangannya sebagai perkiraan. */
export const ROAD_REACH_M: number = data.reach_m;
export const ROAD_EXTENDED_M: number = data.extended_m;

function boundsOf(points: LatLng[]): [LatLng, LatLng] {
  return [
    [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1]))],
    [Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))],
  ];
}

export function segmentBounds(segment: RoadSegment): [LatLng, LatLng] {
  return boundsOf(segment.lines.flat());
}

/** Kotak pembatas semua ruas: [barat daya, timur laut], untuk membingkai peta. */
export const ROADS_BOUNDS: [LatLng, LatLng] = boundsOf(segments.flatMap((segment) => segment.lines.flat()));

const CENTER_RADIUS_DEG = 0.02; // ±2 km: pusat kota, tempat sebagian besar kamera berada

function middle(values: number[]): number {
  return [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
}

const starts = segments.map((segment) => segment.lines[0][0]);
const center: LatLng = [middle(starts.map((p) => p[0])), middle(starts.map((p) => p[1]))];

/** Kotak pembatas ruas di pusat kota: bingkai awal peta, cukup dekat untuk melihat bentuk jalannya. */
export const CENTER_BOUNDS: [LatLng, LatLng] = boundsOf(
  segments
    .filter((segment) => Math.hypot(segment.lines[0][0][0] - center[0], segment.lines[0][0][1] - center[1]) <= CENTER_RADIUS_DEG)
    .flatMap((segment) => segment.lines.flat()),
);
