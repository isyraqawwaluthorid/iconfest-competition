import Link from "next/link";
import { Suspense } from "react";
import { InsightView } from "@/components/insight/InsightView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getActiveAlerts, getCameraOverview, getWeather } from "@/lib/queries";
import { isOnline } from "@/lib/status";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Denyut Kota Semarang</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Kondisi air, lalu lintas, dan hujan per kecamatan, dibaca dari CCTV publik setiap 5 menit dan digabung dengan
          prakiraan cuaca.
        </p>
      </div>
      <Suspense fallback={<HomeSkeleton />}>
        <Home />
      </Suspense>
    </div>
  );
}

async function Home() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return <EmptyState title="Belum ada data" reason="Daftar kamera sumber data belum dimuat ke database." />;
  }
  // Peringatan dan hujan adalah pelengkap: jika gagal dimuat, beranda tetap tampil tanpa keduanya.
  const [alerts, weather] = await Promise.all([getActiveAlerts().catch(() => []), getWeather().catch(() => [])]);
  const online = cameras.filter(isOnline).length;

  return (
    <>
      <InsightView initialCameras={cameras} initialAlerts={alerts} weather={weather} />
      <p className="text-xs text-muted">
        Sumber data: {cameras.length} kamera publik, {online} aktif saat halaman dimuat.{" "}
        <Link href="/kamera" className="text-primary underline">
          Lihat peta kamera
        </Link>{" "}
        atau{" "}
        <Link href="/mosaik" className="text-primary underline">
          mosaik gambar
        </Link>
        .
      </p>
    </>
  );
}

function HomeSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
      <Skeleton className="h-[60vh] min-h-80 w-full" />
    </div>
  );
}
