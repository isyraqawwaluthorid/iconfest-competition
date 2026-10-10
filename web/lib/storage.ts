const BUCKET = "snapshots";

/** URL publik snapshot. `version` (waktu snapshot) memaksa browser mengambil gambar terbaru. */
export function snapshotUrl(path: string, version?: string | null): string {
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`;
  return version ? `${base}?v=${encodeURIComponent(version)}` : base;
}
