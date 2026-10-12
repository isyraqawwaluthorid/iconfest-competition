import type { Metadata } from "next";
import { Suspense } from "react";
import { SimulationView } from "@/components/insight/SimulationView";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Simulasi kejadian" };

/**
 * Simulasi kejadian air naik. Belum pernah ada kejadian nyata sejak sistem berjalan, jadi halaman ini
 * memperlihatkan bagaimana status, peringatan hulu-hilir, dan ringkasan AI berubah, dengan label yang jelas.
 */
export default function SimulationPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 p-3">
          <Skeleton className="min-h-[32rem] w-full flex-1" />
        </div>
      }
    >
      <Simulation />
    </Suspense>
  );
}

async function Simulation() {
  const cameras = await getCameraOverview();
  if (cameras.length === 0) {
    return (
      <div className="page">
        <EmptyState title="Belum ada data" reason="Daftar kamera sumber data belum dimuat ke database." />
      </div>
    );
  }
  return <SimulationView cameras={cameras} />;
}
