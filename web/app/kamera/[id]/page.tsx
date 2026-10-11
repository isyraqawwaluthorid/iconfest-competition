import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CountSummary } from "@/components/camera/CameraPanel";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { DensityChart } from "@/components/traffic/DensityChart";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WaterCard } from "@/components/water/WaterCard";
import { getCamera, getReferenceLines, getTrafficSeries, getWaterReadings } from "@/lib/queries";
import { DENSITY, healthOf, isOnline, NOT_ASSESSED, WATER } from "@/lib/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUALITY_LABEL = { good: "Baik", fair: "Cukup", poor: "Buruk" } as const;

export default function CameraPage({ params }: PageProps<"/kamera/[id]">) {
  return (
    <div className="space-y-4">
      <Link href="/peta" className="text-sm font-medium text-primary underline">
        ← Kembali ke peta
      </Link>
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <CameraDetail params={params} />
      </Suspense>
    </div>
  );
}

async function CameraDetail({ params }: Pick<PageProps<"/kamera/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const camera = await getCamera(id);
  if (!camera) notFound();

  const counted = camera.modules.includes("traffic") || camera.modules.includes("crowd");
  const watched = camera.modules.includes("water");
  const metric = camera.modules.includes("traffic") ? "vehicle_total" : "persons";
  const [series, readings, lines] = await Promise.all([
    counted ? getTrafficSeries(id) : [],
    watched && camera.is_calibrated ? getWaterReadings(id) : [],
    watched && camera.is_calibrated ? getReferenceLines(id) : [],
  ]);

  return (
    <>
      <div>
        <h1 className="text-2xl font-semibold">{camera.name}</h1>
        <p className="mt-1 text-sm text-muted">{camera.owner ?? "Pemilik tidak tercatat"}</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge status={healthOf(camera)} />
          {watched && camera.is_calibrated ? (
            <Badge status={camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED} />
          ) : null}
          {counted && isOnline(camera) ? <Badge status={DENSITY[camera.density_level ?? "tidak_diketahui"]} /> : null}
          <FreshnessTag at={camera.last_checked_at} prefix="Diperiksa" />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Gambar terakhir">
          <SnapshotView camera={camera} lines={lines} />
          <p className="mt-2 text-xs text-muted">
            Kualitas gambar: {camera.latest_quality ? QUALITY_LABEL[camera.latest_quality] : "belum dinilai"}
            {camera.is_night ? " · kondisi malam" : ""}
          </p>
        </Card>

        {watched ? (
          <Card title="Kondisi air">
            <WaterCard camera={camera} readings={readings} />
          </Card>
        ) : null}

        {counted ? (
          <Card title={metric === "vehicle_total" ? "Kepadatan lalu lintas" : "Keramaian"}>
            {isOnline(camera) ? <CountSummary camera={camera} /> : null}
            <div className="mt-3">
              <DensityChart points={series} metric={metric} />
            </div>
            <p className="mt-2 text-xs text-muted">24 jam terakhir, satu titik per 5 menit.</p>
          </Card>
        ) : null}
      </div>
    </>
  );
}
