import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CameraAdminTable } from "@/components/admin/CameraAdminTable";
import { Skeleton } from "@/components/ui/Skeleton";
import { getAdminCameras } from "@/lib/admin/queries";
import { isAdminRequest } from "@/lib/admin/session";

export default function AdminCamerasPage() {
  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold">Kamera</h1>
        <p className="mt-1 text-sm text-muted">
          Tandai kamera unggulan, isi jenis air dan sistem sungainya, lalu kalibrasi. Perubahan tersimpan langsung.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CameraTable />
      </Suspense>
    </div>
  );
}

async function CameraTable() {
  if (!(await isAdminRequest())) redirect("/admin/login");
  return <CameraAdminTable initialCameras={await getAdminCameras()} />;
}
