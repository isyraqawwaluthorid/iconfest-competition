import { NextResponse } from "next/server";
import { cameraPatchSchema } from "@/lib/admin/schemas";
import { isAdminRequest } from "@/lib/admin/session";
import { getServiceSupabase } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request, context: RouteContext<"/api/admin/cameras/[id]">) {
  if (!(await isAdminRequest())) return NextResponse.json({ error: "Sesi admin tidak sah." }, { status: 401 });

  const { id } = await context.params;
  if (!UUID.test(id)) return NextResponse.json({ error: "ID kamera tidak valid." }, { status: 400 });

  const parsed = cameraPatchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid.", details: parsed.error.issues }, { status: 400 });
  }

  const patch = { ...parsed.data };
  if (patch.river_system === "") patch.river_system = null;

  const { data, error } = await getServiceSupabase()
    .from("cameras")
    .update(patch)
    .eq("id", id)
    .select("id, is_featured, is_active, water_kind, river_system")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Kamera tidak ditemukan." }, { status: 404 });
  return NextResponse.json({ camera: data });
}
