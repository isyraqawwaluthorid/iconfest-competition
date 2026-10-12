import type { Metadata } from "next";
import { Suspense } from "react";
import { TrafficView } from "@/components/traffic/TrafficView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Lalu lintas" };

/** Lalu lintas dari dekat: ruas jalan di sekitar tiap kamera, diwarnai menurut kepadatannya dibanding biasanya. */
export default function TrafficPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 p-3">
          <Skeleton className="min-h-[32rem] w-full flex-1" />
        </div>
      }
    >
      <Traffic />
    </Suspense>
  );
}

async function Traffic() {
  const cameras = (await getCameraOverview()).filter((camera) => camera.modules.includes("traffic"));
  if (cameras.length === 0) {
    return (
      <div className="page">
        <EmptyState title="Belum ada kamera lalu lintas" reason="Daftar kamera sumber data belum dimuat ke database." />
      </div>
    );
  }
  return <TrafficView initialCameras={cameras} />;
}
