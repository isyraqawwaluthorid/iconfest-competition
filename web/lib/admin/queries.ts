import "server-only";
import { getServiceSupabase } from "@/lib/supabase/server";
import type { CameraModule, Health } from "@/lib/types";
import type { ReferenceLevel, WaterKind } from "./schemas";

type Point = [number, number];

export type AdminCamera = {
  id: string;
  name: string;
  source_link_id: number;
  categories: string[];
  modules: CameraModule[];
  owner: string | null;
  is_active: boolean;
  is_featured: boolean;
  water_kind: WaterKind | null;
  river_system: string | null;
  is_calibrated: boolean;
  health: Health | null;
  latest_snapshot_path: string | null;
  latest_snapshot_at: string | null;
};

export type AdminCameraDetail = AdminCamera & {
  roi: { points: Point[] } | null;
  reference_lines: { level: ReferenceLevel; points: [Point, Point] }[] | null;
  calibration_notes: string | null;
  reference_image_day: string | null;
  reference_image_night: string | null;
};

const LIST_COLUMNS =
  "id, name, source_link_id, categories, modules, owner, is_active, is_featured, water_kind, river_system, roi, " +
  "camera_status(health, latest_snapshot_path, latest_snapshot_at)";
const DETAIL_COLUMNS = `${LIST_COLUMNS}, reference_lines, calibration_notes, reference_image_day, reference_image_night`;

type StatusJoin = Pick<AdminCamera, "health" | "latest_snapshot_path" | "latest_snapshot_at">;
type Row = Omit<AdminCameraDetail, keyof StatusJoin | "is_calibrated"> & { camera_status: StatusJoin | StatusJoin[] | null };

function toCamera(row: Row): AdminCameraDetail {
  const { camera_status, ...camera } = row;
  const status = Array.isArray(camera_status) ? camera_status[0] : camera_status;
  return {
    ...camera,
    is_calibrated: (camera.roi?.points?.length ?? 0) >= 3,
    health: status?.health ?? null,
    latest_snapshot_path: status?.latest_snapshot_path ?? null,
    latest_snapshot_at: status?.latest_snapshot_at ?? null,
  };
}

/** Semua kamera, termasuk yang dinonaktifkan. Hanya untuk halaman admin. */
export async function getAdminCameras(): Promise<AdminCamera[]> {
  const { data, error } = await getServiceSupabase().from("cameras").select(LIST_COLUMNS).order("name");
  if (error) throw new Error(`Gagal memuat kamera: ${error.message}`);
  return (data as unknown as Row[]).map(toCamera);
}

export async function getAdminCamera(id: string): Promise<AdminCameraDetail | null> {
  const { data, error } = await getServiceSupabase().from("cameras").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw new Error(`Gagal memuat kamera: ${error.message}`);
  return data ? toCamera(data as unknown as Row) : null;
}
