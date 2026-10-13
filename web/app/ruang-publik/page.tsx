import type { Metadata } from "next";
import { Suspense } from "react";
import { PublicSpacesView } from "@/components/crowd/PublicSpacesView";
import { Skeleton } from "@/components/ui/Skeleton";
import { getActivityProfile, getCameraOverview } from "@/lib/queries";

export const metadata: Metadata = { title: "Ruang publik" };

/** Keramaian ruang publik: pejalan kaki yang terlihat di tempat-tempat yang kameranya menghadap ruang pejalan kaki. */
export default function PublicSpacesPage() {
  return (
    <Suspense
      fallback={
        <div className="page">
          <Skeleton className="h-96 w-full" />
        </div>
      }
    >
      <PublicSpaces />
    </Suspense>
  );
}

async function PublicSpaces() {
  const cameras = await getCameraOverview();
  // Profil per jam adalah pelengkap: tanpa itu jumlah yang terlihat sekarang tetap tampil, tanpa pembanding.
  const profile = await getActivityProfile().catch(() => null);
  return <PublicSpacesView initialCameras={cameras} profile={profile} />;
}
