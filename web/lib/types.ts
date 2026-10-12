export type Health = "live" | "frozen" | "dead" | "unknown";
export type ImageQuality = "good" | "fair" | "poor";
export type WaterStatus = "normal" | "waspada" | "siaga" | "awas" | "tidak_dapat_dinilai";
export type DensityLevel = "lancar" | "normal" | "ramai" | "padat" | "tidak_diketahui";
export type TrashLevel = "tidak_terlihat" | "sedikit" | "banyak" | "tidak_dapat_dinilai" | "tidak_relevan";
export type WaterTrend = "naik_cepat" | "naik" | "stabil" | "turun" | "tidak_diketahui";
export type RiskLevel = "rendah" | "sedang" | "tinggi" | "sangat_tinggi" | "tidak_diketahui";
export type RoadFlood =
  | "tidak_tergenang"
  | "genangan_ringan"
  | "genangan_sedang"
  | "genangan_tinggi"
  | "tidak_dapat_dinilai"
  | "tidak_relevan";
export type AlertLevel = "info" | "waspada" | "siaga" | "awas";
export type ReferenceLevel = "normal" | "waspada" | "siaga" | "awas";
export type ReferenceLine = { level: ReferenceLevel; points: [[number, number], [number, number]] };

/** Satu penilaian AI atas satu frame kamera air (tabel `water_readings`). */
export type WaterReading = {
  captured_at: string;
  /** Gambar yang dinilai, di Storage. Kosong untuk penilaian sebelum gambar bukti mulai disimpan. */
  snapshot_path: string | null;
  status: WaterStatus;
  trash: TrashLevel;
  water_position: string | null;
  confidence: number | null;
  reason: string | null;
  trigger: "change" | "heartbeat" | "rain" | "manual" | null;
  is_night: boolean | null;
};
/**
 * Satu penilaian AI untuk linimasa, beserta catatan aturan yang disimpan worker bersamanya.
 * `level`: level yang dihitung aturan dari penilaian ini; `null` berarti diabaikan (keyakinan rendah,
 * gambar buruk, atau bertentangan dengan referensi); `undefined` berarti penilaian lama tanpa catatan.
 * `previous` dan `confirmed`: status resmi sebelum dan sesudah penilaian ini.
 */
export type SiteReading = {
  camera_id: string;
  captured_at: string;
  status: WaterStatus;
  road_flood: RoadFlood | null;
  confidence: number | null;
  level?: WaterStatus | null;
  previous?: WaterStatus | null;
  confirmed?: WaterStatus | null;
  /** Jumlah penilaian sepakat yang dibutuhkan aturan untuk menaikkan status. */
  needed?: number;
  /** Alasan singkat dari AI kamera untuk penilaian ini. */
  reason?: string | null;
  /** Gambar yang dinilai, di Storage; kosong untuk penilaian simulasi. */
  snapshot_path?: string | null;
};
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
  weather_grid_id: string | null;
  is_calibrated: boolean;
  health: Health | null;
  last_checked_at: string | null;
  last_live_at: string | null;
  latest_snapshot_path: string | null;
  latest_snapshot_at: string | null;
  latest_quality: ImageQuality | null;
  is_night: boolean | null;
  water_status: WaterStatus | null;
  water_status_since: string | null;
  water_trend: WaterTrend | null;
  road_flood: RoadFlood | null;
  trash: TrashLevel | null;
  water_confidence: number | null;
  needs_verification: boolean | null;
  risk_score: number | null;
  risk_level: RiskLevel | null;
  risk_components: RiskComponents | null;
  vehicle_count: number | null;
  person_count: number | null;
  density_index: number | null;
  density_level: DensityLevel | null;
  is_anomaly: boolean | null;
  baseline_is_provisional: boolean | null;
  status_updated_at: string | null;
};

/** Rincian skor risiko yang disimpan worker: nilai tiap komponen (0..1), bobotnya, dan masukannya. */
export type RiskComponents = {
  status: number;
  trend: number;
  upstream: number;
  rain: number;
  weights: Record<"status" | "trend" | "upstream" | "rain", number>;
  inputs?: { rain_next_3h_mm?: number | null; upstream_status?: string | null; upstream_name?: string | null };
};

/** Peringatan aktif dari tabel `alerts`; teksnya dibuat worker dari template. */
export type Alert = {
  id: string;
  created_at: string;
  updated_at: string;
  type: string;
  level: AlertLevel;
  camera_id: string | null;
  title: string;
  message: string;
};

/** Hujan terbaru untuk satu titik grid cuaca (Open-Meteo). */
export type GridWeather = {
  grid_id: string;
  name: string;
  lat: number;
  lng: number;
  fetched_at: string;
  precip_now_mm: number;
  precip_next_1h_mm: number;
  precip_next_3h_mm: number;
  precip_next_6h_mm: number;
  precip_prob_max_3h: number | null;
  /** Prakiraan per jam ke depan (hingga 12 jam); `time` adalah akhir jam itu, dalam detik epoch. */
  hourly: { time: number; precipitation: number; probability: number | null }[];
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
