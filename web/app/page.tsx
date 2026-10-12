import { Suspense } from "react";
import { InsightView } from "@/components/insight/InsightView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getActiveAlerts, getCameraOverview, getLatestInsight, getSiteReadings, getWeather } from "@/lib/queries";

/** Beranda "Denyut Kota": peta memenuhi layar, ringkasan dan rincian tampil sebagai panel di atasnya. */
export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 p-3">
          <Skeleton className="min-h-[32rem] w-full flex-1" />
        </div>
      }
    >
      <Home />
    </Suspense>
  );
}

async function Home() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return (
      <div className="page">
        <EmptyState title="Belum ada data" reason="Daftar kamera sumber data belum dimuat ke database." />
      </div>
    );
  }
  // Peringatan, hujan, dan ringkasan AI adalah pelengkap: jika gagal dimuat, beranda tetap tampil tanpanya.
  const [alerts, weather, insight, readings] = await Promise.all([
    getActiveAlerts().catch(() => []),
    getWeather().catch(() => []),
    getLatestInsight().catch(() => null),
    getSiteReadings().catch(() => []),
  ]);
  return (
    <InsightView initialCameras={cameras} initialAlerts={alerts} initialInsight={insight} initialReadings={readings} weather={weather} />
  );
}
