import type { Metadata } from "next";
import { Suspense } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { WaterView } from "@/components/water/WaterView";
import { getCameraOverview, getEvents, getRiverLinks, getSiteReadings, getWeather } from "@/lib/queries";

export const metadata: Metadata = { title: "Air" };

/** Kondisi air per lokasi: status resmi tiap pompa, sungai, kolam, dan jalan rawan genangan, dengan bukti dan hubungan hulu–hilirnya. */
export default function WaterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 p-3">
          <Skeleton className="min-h-[32rem] w-full flex-1" />
        </div>
      }
    >
      <Water />
    </Suspense>
  );
}

async function Water() {
  const cameras = await getCameraOverview();
  if (!cameras.some((camera) => camera.modules.includes("water") && camera.is_calibrated)) {
    return (
      <div className="page">
        <EmptyState
          title="Belum ada lokasi air yang dikalibrasi"
          reason="Sistem hanya menilai status air pada kamera yang area air dan garis acuannya sudah ditandai."
        />
      </div>
    );
  }
  // Semua ini pelengkap: jika gagal dimuat, peta dan status tetap tampil tanpanya.
  const [readings, weather, links, events] = await Promise.all([
    getSiteReadings().catch(() => []),
    getWeather().catch(() => []),
    getRiverLinks().catch(() => []),
    getEvents(50).catch(() => []),
  ]);
  return (
    <WaterView
      initialCameras={cameras}
      initialReadings={readings}
      weather={weather}
      links={links}
      openEvents={events.filter((event) => event.ended_at === null).length}
    />
  );
}
