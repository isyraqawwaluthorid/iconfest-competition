import { z } from "zod";
import { CITY_BOUNDS, districtOf, type LatLng } from "./geo/districts";
import type { CameraOverview } from "./types";

/**
 * Lapisan "Aktivitas per jam": seberapa ramai tiap kawasan biasanya pada jam tertentu.
 * Sumbernya profil yang dihitung worker (fusion/activity.py): rata-rata kendaraan dan orang yang terlihat
 * per gambar, per kamera, per jam (WIB). Kawasan digambar sebagai heksagon yang memenuhi kota; hanya heksagon
 * yang punya kamera yang berwarna. Kawasan tanpa kamera digambar abu-abu, tidak diisi perkiraan.
 */

const hourly = z.array(z.number().nullable()).length(24);

export const activityProfileSchema = z.object({
  generated_at: z.string(),
  since: z.string().nullable(),
  days: z.number(),
  cameras: z.record(z.string(), z.object({ vehicles: hourly, persons: hourly })),
});

export type ActivityProfile = z.infer<typeof activityProfileSchema>;
export type ActivityMetric = "vehicles" | "persons";

export const ACTIVITY_METRICS: { id: ActivityMetric; label: string; unit: string }[] = [
  { id: "vehicles", label: "Kendaraan", unit: "kendaraan terlihat per gambar" },
  { id: "persons", label: "Orang", unit: "orang terlihat per gambar" },
];

export const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
export const HEX_RADIUS_M = 400; // dari pusat ke sudut; lebar heksagon ±700 m
export const ACTIVITY_LEVELS = 5;

const ORIGIN: LatLng = [-6.99, 110.42]; // Simpang Lima; hanya titik acuan proyeksi
const M_PER_DEG_LAT = 110_540;
const M_PER_DEG_LNG = 111_320 * Math.cos((ORIGIN[0] * Math.PI) / 180);

export type Hex = {
  id: string;
  center: LatLng;
  ring: LatLng[];
  /** Kecamatan tempat pusat heksagon berada; `null` bila di luar batas kota. */
  district: string | null;
  cameras: CameraOverview[];
  /** Rata-rata antar kamera di heksagon, per jam; `null` bila tidak ada kamera yang punya data pada jam itu. */
  hourly: (number | null)[];
};

/** Heksagon (sudut di atas) yang memuat titik ini, sebagai koordinat aksial. */
function hexOf(lat: number, lng: number): [number, number] {
  const x = (lng - ORIGIN[1]) * M_PER_DEG_LNG;
  const y = (lat - ORIGIN[0]) * M_PER_DEG_LAT;
  const q = ((Math.sqrt(3) / 3) * x - y / 3) / HEX_RADIUS_M;
  const r = ((2 / 3) * y) / HEX_RADIUS_M;
  // Pembulatan kubus: bulatkan ketiga sumbu, lalu perbaiki yang paling jauh meleset.
  let [rq, rr] = [Math.round(q), Math.round(r)];
  const rs = Math.round(-q - r);
  const [dq, dr, ds] = [Math.abs(rq - q), Math.abs(rr - r), Math.abs(rs + q + r)];
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return [rq, rr];
}

function hexCenter(q: number, r: number): [number, number] {
  return [HEX_RADIUS_M * Math.sqrt(3) * (q + r / 2), HEX_RADIUS_M * 1.5 * r];
}

function toLatLng(x: number, y: number): LatLng {
  return [ORIGIN[0] + y / M_PER_DEG_LAT, ORIGIN[1] + x / M_PER_DEG_LNG];
}

function hexRing(q: number, r: number): LatLng[] {
  const [x, y] = hexCenter(q, r);
  return Array.from({ length: 6 }, (_, corner) => {
    const angle = (Math.PI / 180) * (60 * corner - 30);
    return toLatLng(x + HEX_RADIUS_M * Math.cos(angle), y + HEX_RADIUS_M * Math.sin(angle));
  });
}

/**
 * Heksagon di dalam batas kota yang tidak punya kamera, supaya kisi heksagon memenuhi kota dan kawasan
 * tanpa data terlihat sebagai abu-abu. `occupied` berisi id heksagon yang sudah punya kamera.
 */
export function emptyHexRings(occupied: ReadonlySet<string>): LatLng[][] {
  const [[south, west], [north, east]] = CITY_BOUNDS;
  const rows = [south, north].map((lat) => ((lat - ORIGIN[0]) * M_PER_DEG_LAT) / (1.5 * HEX_RADIUS_M));
  const columns = [west, east].map((lng) => ((lng - ORIGIN[1]) * M_PER_DEG_LNG) / (Math.sqrt(3) * HEX_RADIUS_M));
  const rings: LatLng[][] = [];
  for (let r = Math.floor(rows[0]) - 1; r <= Math.ceil(rows[1]) + 1; r++) {
    for (let q = Math.floor(columns[0] - r / 2) - 1; q <= Math.ceil(columns[1] - r / 2) + 1; q++) {
      if (occupied.has(`${q},${r}`)) continue;
      const [x, y] = hexCenter(q, r);
      const [lat, lng] = toLatLng(x, y);
      if (districtOf(lat, lng) !== null) rings.push(hexRing(q, r));
    }
  }
  return rings;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Heksagon yang punya kamera berprofil, beserta rata-rata per jamnya untuk metrik yang dipilih. */
export function buildHexes(cameras: CameraOverview[], profile: ActivityProfile, metric: ActivityMetric): Hex[] {
  const members = new Map<string, { q: number; r: number; cameras: CameraOverview[] }>();
  for (const camera of cameras) {
    if (!profile.cameras[camera.id]) continue;
    const [q, r] = hexOf(camera.lat, camera.lng);
    const id = `${q},${r}`;
    const hex = members.get(id) ?? { q, r, cameras: [] };
    hex.cameras.push(camera);
    members.set(id, hex);
  }
  return [...members.entries()].map(([id, { q, r, cameras: inside }]) => {
    const [x, y] = hexCenter(q, r);
    const center = toLatLng(x, y);
    return {
      id,
      center,
      ring: hexRing(q, r),
      district: districtOf(center[0], center[1]),
      cameras: inside,
      hourly: HOURS.map((hour) =>
        mean(inside.flatMap((camera) => profile.cameras[camera.id][metric][hour] ?? [])),
      ),
    };
  });
}

/**
 * Batas antar tingkat warna: kuantil dari semua nilai heksagon di semua jam, supaya warna satu jam bisa
 * dibandingkan dengan jam lain saat penggeser digerakkan. Kosong bila belum ada nilai.
 */
export function activityBreaks(hexes: Hex[]): number[] {
  const values = hexes.flatMap((hex) => hex.hourly.filter((value): value is number => value !== null)).sort((a, b) => a - b);
  if (values.length === 0) return [];
  return Array.from({ length: ACTIVITY_LEVELS - 1 }, (_, i) => values[Math.floor(((i + 1) * values.length) / ACTIVITY_LEVELS)]);
}

/** Tingkat 1 (paling sepi) sampai 5 (paling ramai); 0 berarti tidak ada data pada jam itu. */
export function activityLevel(value: number | null, breaks: number[]): number {
  if (value === null || breaks.length === 0) return 0;
  return 1 + breaks.filter((limit) => value >= limit).length;
}

/**
 * Rata-rata antar heksagon per jam: bentuk satu hari untuk seluruh kawasan terpantau. Jam yang datanya
 * baru ada di kurang dari separuh heksagon dikosongkan, supaya jam yang belum terekam tidak tampak sepi.
 */
export function cityHourly(hexes: Hex[]): (number | null)[] {
  return HOURS.map((hour) => {
    const values = hexes.flatMap((hex) => hex.hourly[hour] ?? []);
    return values.length * 2 >= hexes.length ? mean(values) : null;
  });
}

export function peakHour(values: (number | null)[]): number | null {
  let best: number | null = null;
  values.forEach((value, hour) => {
    if (value !== null && value > 0 && (best === null || value > (values[best] ?? 0))) best = hour;
  });
  return best;
}

/** Nama kawasan sebuah heksagon: nama kamera di dalamnya, karena heksagon sendiri tidak bernama. */
export function hexTitle(hex: Hex): string {
  const [first, ...rest] = hex.cameras.map((camera) => camera.name);
  return rest.length === 0 ? `Sekitar ${first}` : `Sekitar ${first} dan ${rest.length} kamera lain`;
}

/** "17.00–18.00" */
export function hourRange(hour: number): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hour)}.00–${pad((hour + 1) % 24)}.00`;
}

/** Jam sekarang di Semarang (WIB, UTC+7), dari waktu dalam ms. */
export function hourWib(now: number): number {
  return new Date(now + 7 * 3_600_000).getUTCHours();
}
