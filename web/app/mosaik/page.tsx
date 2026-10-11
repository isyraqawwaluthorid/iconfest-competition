import type { Metadata } from "next";
import { Suspense } from "react";
import { MosaicView } from "@/components/mosaic/MosaicView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Semarang Saat Ini" };

export default function MosaicPage() {
  return (
    <div className="page space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Semarang saat ini</h1>
        <p className="mt-1 text-sm text-muted">
          Gambar terakhir dari tiap kamera, diperbarui setiap 5 menit. Ketuk gambar untuk melihat detail kamera.
        </p>
      </div>
      <Suspense fallback={<MosaicSkeleton />}>
        <Mosaic />
      </Suspense>
    </div>
  );
}

async function Mosaic() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return <EmptyState title="Belum ada kamera" reason="Daftar kamera belum dimuat ke database." />;
  }
  return <MosaicView initialCameras={cameras} />;
}

function MosaicSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }, (_, i) => (
        <Skeleton key={i} className="aspect-video" />
      ))}
    </div>
  );
}
