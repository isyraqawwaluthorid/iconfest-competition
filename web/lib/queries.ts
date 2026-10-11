import { getSupabase } from "./supabase/public";
import type { CameraOverview, ReferenceLine, TrafficPoint, WaterReading, WorkerHeartbeat } from "./types";

/** Semua query baca untuk halaman publik. Selalu memfilter `source = 'live'` pada deret waktu. */

export async function getCameraOverview(): Promise<CameraOverview[]> {
  const { data, error } = await getSupabase().from("v_camera_overview").select("*").order("name");
  if (error) throw new Error(`Gagal memuat daftar kamera: ${error.message}`);
  return data as CameraOverview[];
}

export async function getCamera(id: string): Promise<CameraOverview | null> {
  const { data, error } = await getSupabase().from("v_camera_overview").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat kamera: ${error.message}`);
  return data as CameraOverview | null;
}

export async function getTrafficSeries(cameraId: string, hours = 24): Promise<TrafficPoint[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await getSupabase()
    .from("traffic_readings")
    .select("captured_at, vehicle_total, persons, density_index, baseline_median")
    .eq("camera_id", cameraId)
    .eq("source", "live")
    .gte("captured_at", since)
    .order("captured_at");
  if (error) throw new Error(`Gagal memuat riwayat kepadatan: ${error.message}`);
  return data as TrafficPoint[];
}

export async function getWaterReadings(cameraId: string, limit = 12): Promise<WaterReading[]> {
  const { data, error } = await getSupabase()
    .from("water_readings")
    .select("captured_at, status, trash, water_position, confidence, reason, trigger, is_night")
    .eq("camera_id", cameraId)
    .eq("source", "live")
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal memuat penilaian air: ${error.message}`);
  return data as WaterReading[];
}

/** Garis acuan kalibrasi satu kamera air, untuk digambar di atas snapshot. */
export async function getReferenceLines(cameraId: string): Promise<ReferenceLine[]> {
  const { data, error } = await getSupabase().from("cameras").select("reference_lines").eq("id", cameraId).maybeSingle();
  if (error) throw new Error(`Gagal memuat garis acuan: ${error.message}`);
  return (data?.reference_lines as ReferenceLine[] | null) ?? [];
}

export async function getWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  const { data, error } = await getSupabase().from("system_status").select("value").eq("key", "worker").maybeSingle();
  if (error) throw new Error(`Gagal memuat status sistem: ${error.message}`);
  return (data?.value as WorkerHeartbeat | undefined) ?? null;
}
