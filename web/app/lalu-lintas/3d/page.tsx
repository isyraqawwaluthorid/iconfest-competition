import type { Metadata } from "next";
import { Suspense } from "react";
import { Traffic3DView } from "@/components/traffic/Traffic3DView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Lalu lintas 3D (percobaan)" };

/** Percobaan: lapisan "Ruas jalan" di atas peta 3D dengan bangunan timbul. Versi datar tetap di `/lalu-lintas`. */
export default function Traffic3DPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 p-3">
          <Skeleton className="min-h-[32rem] w-full flex-1" />
        </div>
      }
    >
      <Traffic3D />
    </Suspense>
  );
}

async function Traffic3D() {
  const cameras = await getCameraOverview();
  if (!cameras.some((camera) => camera.modules.includes("traffic"))) {
    return (
      <div className="page">
        <EmptyState title="Belum ada kamera lalu lintas" reason="Daftar kamera sumber data belum dimuat ke database." />
      </div>
    );
  }
  return <Traffic3DView initialCameras={cameras} />;
}
