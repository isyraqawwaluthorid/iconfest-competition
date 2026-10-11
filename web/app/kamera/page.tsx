import type { Metadata } from "next";
import { Suspense } from "react";
import { MapView } from "@/components/map/MapView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Kamera sumber data" };

export default function CameraIndexPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Kamera sumber data</h1>
        <p className="mt-1 text-sm text-muted">
          Semua kamera publik yang dibaca sistem. Pilih lapisan untuk melihat kondisi per modul; penanda berubah sendiri saat data baru masuk.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-[60vh] min-h-80 w-full" />}>
        <CameraMap />
      </Suspense>
    </div>
  );
}

async function CameraMap() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return <EmptyState title="Belum ada kamera" reason="Daftar kamera belum dimuat ke database." />;
  }
  return <MapView initialCameras={cameras} />;
}
