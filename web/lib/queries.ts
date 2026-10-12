import { insightBodySchema, type Insight } from "./ai-insight";
import { getSupabase } from "./supabase/public";
import type {
  Alert,
  AlertLevel,
  CameraOverview,
  GridWeather,
  ReferenceLine,
  SiteReading,
  TrafficPoint,
  WaterEvent,
  WaterReading,
  WorkerHeartbeat,
} from "./types";

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
    .select("captured_at, snapshot_path, status, trash, water_position, confidence, reason, trigger, is_night")
    .eq("camera_id", cameraId)
    .eq("source", "live")
    .order("captured_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal memuat penilaian air: ${error.message}`);
  // Penilaian lama mencatat lokasi berkas di mesin worker; hanya lokasi Storage yang bisa ditampilkan.
  return (data as WaterReading[]).map((row) => ({
    ...row,
    snapshot_path: row.snapshot_path?.startsWith("readings/") ? row.snapshot_path : null,
  }));
}

/** Penilaian AI semua lokasi air dalam `hours` jam terakhir, urut waktu, untuk linimasa perkembangan. */
export async function getSiteReadings(hours = 2): Promise<SiteReading[]> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString();
  const { data, error } = await getSupabase()
    .from("water_readings")
    .select("camera_id, captured_at, status, road_flood, confidence, reason, snapshot_path, smoothing:raw->smoothing")
    .eq("source", "live")
    .gte("captured_at", since)
    .order("captured_at");
  if (error) throw new Error(`Gagal memuat perkembangan penilaian: ${error.message}`);
  type Outcome = Pick<SiteReading, "level" | "previous" | "confirmed" | "needed" | "recheck_minutes">;
  return data.map(({ smoothing, ...row }) => ({ ...row, ...((smoothing as Outcome | null) ?? {}) })) as SiteReading[];
}

export type Calibration = { lines: ReferenceLine[]; referenceDay: string | null; referenceNight: string | null };

/** Kalibrasi satu kamera air: garis acuan untuk digambar di atas snapshot, dan foto referensi kondisi normal. */
export async function getCalibration(cameraId: string): Promise<Calibration> {
  const { data, error } = await getSupabase()
    .from("cameras")
    .select("reference_lines, reference_image_day, reference_image_night")
    .eq("id", cameraId)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat kalibrasi: ${error.message}`);
  return {
    lines: (data?.reference_lines as ReferenceLine[] | null) ?? [],
    referenceDay: data?.reference_image_day ?? null,
    referenceNight: data?.reference_image_night ?? null,
  };
}

const ALERT_RANK: Record<AlertLevel, number> = { awas: 0, siaga: 1, waspada: 2, info: 3 };

/** Peringatan yang sedang aktif, yang paling serius lebih dulu. */
export async function getActiveAlerts(): Promise<Alert[]> {
  const { data, error } = await getSupabase()
    .from("alerts")
    .select("id, created_at, updated_at, type, level, camera_id, title, message")
    .eq("is_active", true)
    .eq("source", "live")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`Gagal memuat peringatan: ${error.message}`);
  return (data as Alert[]).sort((a, b) => ALERT_RANK[a.level] - ALERT_RANK[b.level]);
}

/** Kejadian yang tercatat, terbaru lebih dulu. Hanya data langsung; simulasi tidak pernah masuk tabel ini. */
export async function getEvents(limit = 200): Promise<WaterEvent[]> {
  const { data, error } = await getSupabase()
    .from("events")
    .select("id, camera_id, kind, started_at, peak_at, peak_status, ended_at, duration_minutes, cameras(name)")
    .eq("source", "live")
    .order("started_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`Gagal memuat riwayat kejadian: ${error.message}`);
  return data.map(({ cameras, ...row }) => ({
    ...row,
    camera_name: (cameras as unknown as { name: string } | null)?.name ?? "Lokasi tidak dikenal",
  })) as WaterEvent[];
}

/** Hujan terbaru per titik grid cuaca. Kosong jika worker belum pernah mengambil cuaca. */
export async function getWeather(): Promise<GridWeather[]> {
  const supabase = getSupabase();
  const [grid, readings] = await Promise.all([
    supabase.from("weather_grid").select("id, name, lat, lng"),
    supabase
      .from("weather_readings")
      .select("grid_id, fetched_at, precip_now_mm, precip_next_1h_mm, precip_next_3h_mm, precip_next_6h_mm, precip_prob_max_3h, hourly")
      .eq("source", "live")
      .order("fetched_at", { ascending: false })
      .limit(36),
  ]);
  if (grid.error) throw new Error(`Gagal memuat wilayah cuaca: ${grid.error.message}`);
  if (readings.error) throw new Error(`Gagal memuat data hujan: ${readings.error.message}`);

  const latest = new Map<string, (typeof readings.data)[number]>();
  for (const row of readings.data) if (!latest.has(row.grid_id)) latest.set(row.grid_id, row);
  return grid.data.flatMap((point): GridWeather[] => {
    const row = latest.get(point.id);
    if (!row) return [];
    return [
      {
        grid_id: point.id,
        name: point.name ?? point.id,
        lat: point.lat,
        lng: point.lng,
        fetched_at: row.fetched_at,
        precip_now_mm: row.precip_now_mm ?? 0,
        precip_next_1h_mm: row.precip_next_1h_mm ?? 0,
        precip_next_3h_mm: row.precip_next_3h_mm ?? 0,
        precip_next_6h_mm: row.precip_next_6h_mm ?? 0,
        precip_prob_max_3h: row.precip_prob_max_3h,
        hourly: Array.isArray(row.hourly) ? (row.hourly as GridWeather["hourly"]) : [],
      },
    ];
  });
}

/**
 * Insight situasi terbaru yang ditulis LLM. `null` jika belum ada, atau jika isinya tidak sesuai schema
 * (lebih baik tidak menampilkan apa pun daripada menampilkan isi yang tidak bisa dipastikan bentuknya).
 */
export async function getLatestInsight(): Promise<Insight | null> {
  const { data, error } = await getSupabase()
    .from("insights")
    .select("id, created_at, model, body")
    .eq("scope", "situasi")
    .eq("source", "live")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Gagal memuat insight: ${error.message}`);
  if (!data) return null;
  const body = insightBodySchema.safeParse(data.body);
  return body.success ? { id: data.id, created_at: data.created_at, model: data.model, ...body.data } : null;
}

export async function getWorkerHeartbeat(): Promise<WorkerHeartbeat | null> {
  const { data, error } = await getSupabase().from("system_status").select("value").eq("key", "worker").maybeSingle();
  if (error) throw new Error(`Gagal memuat status sistem: ${error.message}`);
  return (data?.value as WorkerHeartbeat | undefined) ?? null;
}
