import Link from "next/link";
import { Suspense } from "react";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { getCameraOverview } from "@/lib/queries";
import { isOnline } from "@/lib/status";

export default function HomePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Denyut Kota Semarang</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          CCTV publik Kota Semarang dibaca setiap 5 menit untuk memantau kondisi air, kepadatan lalu lintas, dan
          keramaian ruang publik.
        </p>
      </div>
      <Suspense fallback={<SummarySkeleton />}>
        <Summary />
      </Suspense>
      <Link href="/peta" className="inline-block rounded-token bg-primary px-4 py-2 text-sm font-medium text-on-primary">
        Buka peta kamera
      </Link>
    </div>
  );
}

async function Summary() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return <EmptyState title="Belum ada kamera" reason="Daftar kamera belum dimuat ke database." />;
  }
  const online = cameras.filter(isOnline);
  const busy = online.filter((c) => c.density_level === "ramai" || c.density_level === "padat");
  const latest = cameras.reduce<string | null>(
    (max, c) => (c.status_updated_at && (!max || c.status_updated_at > max) ? c.status_updated_at : max),
    null,
  );

  return (
    <section aria-label="Ringkasan kondisi saat ini" className="space-y-2">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Kamera dipantau" value={cameras.length} />
        <Stat label="Kamera aktif" value={online.length} hint={`${cameras.length - online.length} offline atau beku`} />
        <Stat label="Titik ramai atau padat" value={busy.length} hint="Dibanding kebiasaan tiap kamera" />
        <Stat label="Status air ≥ waspada" value="–" hint="Modul air belum aktif" />
      </div>
      <FreshnessTag at={latest} />
    </section>
  );
}

function SummarySkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-24" />
      ))}
    </div>
  );
}
