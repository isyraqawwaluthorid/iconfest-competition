import { getSupabase } from "./supabase/public";

/** Satu jam pada grafik tren: rata-rata kendaraan terdeteksi per gambar, dari semua titik yang diminta. */
export type TrafficHour = { hour: string; vehicles: number | null; readings: number };

const PAGE = 1000; // batas baris per permintaan PostgREST
const HOUR_MS = 3_600_000;

/**
 * Irama lalu lintas `hours` jam terakhir untuk sekumpulan kamera, dirata-rata per jam.
 * Pembacaan diambil per halaman 1.000 baris (halaman sisanya diminta bersamaan), lalu diringkas di sini;
 * jam tanpa pembacaan dikembalikan dengan `vehicles = null` agar jeda data terlihat sebagai jeda.
 */
export async function getTrafficTrend(cameraIds: string[], hours = 24): Promise<TrafficHour[]> {
  const end = Math.floor(Date.now() / HOUR_MS) * HOUR_MS + HOUR_MS;
  const start = end - hours * HOUR_MS;
  const buckets = Array.from({ length: hours }, (_, index) => ({ hour: new Date(start + index * HOUR_MS).toISOString(), sum: 0, readings: 0 }));
  if (cameraIds.length === 0) return buckets.map(({ hour }) => ({ hour, vehicles: null, readings: 0 }));

  const page = (from: number, withCount: boolean) =>
    getSupabase()
      .from("traffic_readings")
      .select("captured_at, vehicle_total", withCount ? { count: "exact" } : undefined)
      .in("camera_id", cameraIds)
      .eq("source", "live")
      .gte("captured_at", new Date(start).toISOString())
      .order("captured_at")
      .range(from, from + PAGE - 1);

  const first = await page(0, true);
  if (first.error) throw new Error(`Gagal memuat tren lalu lintas: ${first.error.message}`);
  const rest = await Promise.all(
    Array.from({ length: Math.max(0, Math.ceil((first.count ?? 0) / PAGE) - 1) }, (_, index) => page((index + 1) * PAGE, false)),
  );
  for (const result of [first, ...rest]) {
    if (result.error) throw new Error(`Gagal memuat tren lalu lintas: ${result.error.message}`);
    for (const row of result.data) {
      const bucket = buckets[Math.floor((new Date(row.captured_at).getTime() - start) / HOUR_MS)];
      if (bucket) {
        bucket.sum += row.vehicle_total;
        bucket.readings += 1;
      }
    }
  }
  return buckets.map(({ hour, sum, readings }) => ({ hour, vehicles: readings > 0 ? sum / readings : null, readings }));
}
