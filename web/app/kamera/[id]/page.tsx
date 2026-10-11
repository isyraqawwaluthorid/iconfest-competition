import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CountSummary } from "@/components/camera/CameraPanel";
import { EvidenceCompare } from "@/components/camera/EvidenceCompare";
import { NearbyCameras } from "@/components/camera/NearbyCameras";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { DensityChart } from "@/components/traffic/DensityChart";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { RiskBreakdown } from "@/components/water/RiskBreakdown";
import { WaterCard } from "@/components/water/WaterCard";
import { districtOf } from "@/lib/geo/districts";
import { getCalibration, getCamera, getCameraOverview, getTrafficSeries, getWaterReadings, type Calibration } from "@/lib/queries";
import { DENSITY, healthOf, isOnline, NOT_ASSESSED, RISK, WATER } from "@/lib/status";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const QUALITY_LABEL = { good: "Baik", fair: "Cukup", poor: "Buruk" } as const;
const NO_CALIBRATION: Calibration = { lines: [], referenceDay: null, referenceNight: null };

export default function CameraPage({ params }: PageProps<"/kamera/[id]">) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href="/" className="font-medium text-primary hover:underline">
          ← Kembali ke Beranda
        </Link>
        <span className="tint rounded-full px-3 py-1 text-xs font-medium">
          Privasi: tanpa pengenalan wajah dan tanpa pembacaan pelat nomor
        </span>
      </div>
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
  const assessed = camera.modules.includes("water") && camera.is_calibrated;
  const metric = camera.modules.includes("traffic") ? "vehicle_total" : "persons";
  const [series, readings, calibration, all] = await Promise.all([
    counted ? getTrafficSeries(id) : [],
    assessed ? getWaterReadings(id) : [],
    assessed ? getCalibration(id) : NO_CALIBRATION,
    // Kamera sekitar hanya pelengkap: jika gagal dimuat, halaman tetap tampil tanpanya.
    getCameraOverview().catch(() => []),
  ]);
  // Referensi dipilih sesuai waktu gambar terakhir, dengan cadangan referensi yang satunya.
  const preferNight = camera.is_night === true;
  const referencePath = preferNight
    ? (calibration.referenceNight ?? calibration.referenceDay)
    : (calibration.referenceDay ?? calibration.referenceNight);
  const reference = referencePath
    ? { path: referencePath, kind: referencePath === calibration.referenceNight ? ("malam" as const) : ("siang" as const) }
    : null;
  const district = districtOf(camera.lat, camera.lng);
  // Kartu kepadatan sudah tampil di baris pertama untuk kamera tanpa modul air.
  const withTraffic = counted && camera.modules.includes("water");

  return (
    <>
      <div>
        <p className="label-caps text-primary">Bukti visual{district ? ` · Kecamatan ${district}` : ""}</p>
        <h1 className="mt-1 text-3xl font-extrabold">{camera.name}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge status={healthOf(camera)} />
          {assessed ? <Badge status={camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED} /> : null}
          {assessed && camera.risk_level ? <Badge status={RISK[camera.risk_level]} /> : null}
          {counted && isOnline(camera) ? <Badge status={DENSITY[camera.density_level ?? "tidak_diketahui"]} /> : null}
          <FreshnessTag at={camera.last_checked_at} prefix="Diperiksa" />
        </div>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Gambar diam yang diambil tiap 5 menit dari CCTV publik, bukan siaran langsung. Dikelola{" "}
          {camera.owner ?? "pemilik yang tidak tercatat"}.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <Card title="Gambar terakhir">
          <SnapshotView camera={camera} lines={calibration.lines} />
          <p className="mt-2 text-xs text-muted">
            Kualitas gambar: {camera.latest_quality ? QUALITY_LABEL[camera.latest_quality] : "belum dinilai"}
            {camera.is_night ? " · kondisi malam" : ""}
          </p>
        </Card>

        {camera.modules.includes("water") ? (
          <Card
            title="Hasil penilaian AI"
            className={`accent accent-left tone-${(camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED).tone}`}
          >
            <WaterCard camera={camera} readings={readings} />
          </Card>
        ) : counted ? (
          <TrafficCard camera={camera} series={series} metric={metric} />
        ) : null}
      </div>

      {assessed ? (
        <Card title="Pembanding: kondisi normal dan sekarang">
          <EvidenceCompare camera={camera} lines={calibration.lines} reference={reference} readings={readings} />
        </Card>
      ) : null}

      {/* Kamera air yang juga menghitung kendaraan: risiko di samping kepadatan, kamera sekitar di bawahnya. */}
      {assessed && withTraffic ? (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Rincian skor risiko">
            <RiskBreakdown camera={camera} />
          </Card>
          <TrafficCard camera={camera} series={series} metric={metric} />
        </div>
      ) : null}
      {!assessed && withTraffic ? <TrafficCard camera={camera} series={series} metric={metric} /> : null}

      <div className={assessed && !withTraffic ? "grid gap-5 lg:grid-cols-2" : ""}>
        {assessed && !withTraffic ? (
          <Card title="Rincian skor risiko">
            <RiskBreakdown camera={camera} />
          </Card>
        ) : null}
        <Card title="Kamera di sekitar lokasi ini">
          <NearbyCameras camera={camera} all={all} />
        </Card>
      </div>
    </>
  );
}

type TrafficCardProps = {
  camera: NonNullable<Awaited<ReturnType<typeof getCamera>>>;
  series: Awaited<ReturnType<typeof getTrafficSeries>>;
  metric: "vehicle_total" | "persons";
};

function TrafficCard({ camera, series, metric }: TrafficCardProps) {
  return (
    <Card title={metric === "vehicle_total" ? "Kepadatan lalu lintas" : "Keramaian"}>
      {isOnline(camera) ? <CountSummary camera={camera} /> : null}
      <div className="mt-3">
        <DensityChart points={series} metric={metric} />
      </div>
      <p className="mt-2 text-xs text-muted">24 jam terakhir, satu titik per 5 menit.</p>
    </Card>
  );
}
