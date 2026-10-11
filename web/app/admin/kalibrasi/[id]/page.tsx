import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { CalibrationTool } from "@/components/admin/CalibrationTool";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminCamera } from "@/lib/admin/queries";
import { isAdminRequest } from "@/lib/admin/session";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function CalibrationPage({ params }: PageProps<"/admin/kalibrasi/[id]">) {
  return (
    <div className="space-y-3">
      <Link href="/admin/kamera" className="text-sm font-medium text-primary underline">
        ← Kembali ke daftar kamera
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <Calibration params={params} />
      </Suspense>
    </div>
  );
}

async function Calibration({ params }: Pick<PageProps<"/admin/kalibrasi/[id]">, "params">) {
  if (!(await isAdminRequest())) redirect("/admin/login");
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const camera = await getAdminCamera(id);
  if (!camera) notFound();

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">Kalibrasi: {camera.name}</h1>
        <p className="mt-1 text-sm text-muted">
          Tandai area air dan garis acuan pada benda tetap. Sistem menilai status air relatif terhadap garis ini, bukan
          mengukur tinggi air dalam cm.
        </p>
      </div>
      {/* key: muat ulang alat dengan data tersimpan setelah refresh */}
      <CalibrationTool key={`${camera.id}-${camera.latest_snapshot_at}`} camera={camera} />
    </>
  );
}
