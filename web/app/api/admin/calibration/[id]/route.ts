import { NextResponse } from "next/server";
import { calibrationSchema } from "@/lib/admin/schemas";
import { isAdminRequest } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKET = "snapshots";

export async function POST(request: Request, context: RouteContext<"/api/admin/calibration/[id]">) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Sesi admin tidak sah." }, { status: 401 });

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID kamera tidak valid." }, { status: 400 });

  const parsed = calibrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data kalibrasi tidak valid.", details: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;
  const supabase = getServiceSupabase();

  const update: Record<string, unknown> = {
    roi: input.roi,
    reference_lines: input.reference_lines,
    calibration_notes: input.calibration_notes || null,
    water_kind: input.water_kind,
    river_system: input.river_system || null,
  };

  if (input.save_reference) {
    // Salin snapshot terbaru menjadi foto referensi kondisi normal (siang atau malam).
    const source = `latest/${id}.jpg`;
    const target = `reference/${id}/${input.save_reference}.jpg`;
    const download = await supabase.storage.from(BUCKET).download(source);
    if (download.error) {
      return NextResponse.json({ error: "Snapshot terbaru kamera ini belum ada, referensi tidak bisa disimpan." }, { status: 409 });
    }
    const upload = await supabase.storage
      .from(BUCKET)
      .upload(target, download.data, { contentType: "image/jpeg", upsert: true, cacheControl: "60" });
    if (upload.error) return NextResponse.json({ error: upload.error.message }, { status: 500 });
    update[input.save_reference === "day" ? "reference_image_day" : "reference_image_night"] = target;
  }

  const { data, error } = await supabase
    .from("cameras")
    .update(update)
    .eq("id", id)
    .select("id, roi, reference_lines, calibration_notes, water_kind, river_system, reference_image_day, reference_image_night")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kamera tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ camera: data });
}
