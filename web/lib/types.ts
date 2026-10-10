export type Health = "live" | "frozen" | "dead" | "unknown";
export type ImageQuality = "good" | "fair" | "poor";
export type WaterStatus = "normal" | "waspada" | "siaga" | "awas" | "tidak_dapat_dinilai";
export type DensityLevel = "lancar" | "normal" | "ramai" | "padat" | "tidak_diketahui";
export type CameraModule = "traffic" | "crowd" | "water";

/** Satu baris view `v_camera_overview`: kamera aktif beserta kondisi terkininya. */
export type CameraOverview = {
  id: string;
  name: string;
  categories: string[];
  modules: CameraModule[];
  owner: string | null;
  lat: number;
  lng: number;
  stream_url: string;
  is_featured: boolean;
  water_kind: string | null;
  river_system: string | null;
  is_calibrated: boolean;
  health: Health | null;
  last_checked_at: string | null;
  last_live_at: string | null;
  latest_snapshot_path: string | null;
  latest_snapshot_at: string | null;
  latest_quality: ImageQuality | null;
  is_night: boolean | null;
  water_status: WaterStatus | null;
  vehicle_count: number | null;
  person_count: number | null;
  density_index: number | null;
  density_level: DensityLevel | null;
  is_anomaly: boolean | null;
  baseline_is_provisional: boolean | null;
  status_updated_at: string | null;
};

/** Baris tabel `camera_status` seperti yang dikirim Supabase Realtime. */
export type CameraStatusRow = Partial<Omit<CameraOverview, "id" | "status_updated_at">> & {
  camera_id: string;
  updated_at?: string | null;
};

export type TrafficPoint = {
  captured_at: string;
  vehicle_total: number;
  persons: number;
  density_index: number | null;
  baseline_median: number | null;
};

/** Isi `system_status.value` untuk key `worker`. */
export type WorkerHeartbeat = {
  last_seen: string;
  cycle_ms?: number;
  cameras?: { live: number; frozen: number; dead: number };
  version?: string;
};
