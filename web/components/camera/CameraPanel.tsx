import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DENSITY, healthOf, isOnline } from "@/lib/status";
import type { CameraOverview } from "@/lib/types";
import { SnapshotView } from "./SnapshotView";

const MODULE_LABEL: Record<string, string> = { traffic: "Lalu lintas", crowd: "Ruang publik", water: "Air" };

/** Ringkasan satu kamera: status, snapshot, dan angka terakhir. Dipakai di panel peta. */
export function CameraPanel({ camera }: { camera: CameraOverview }) {
  const counted = camera.modules.includes("traffic") || camera.modules.includes("crowd");
  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">{camera.name}</h2>
        <p className="text-xs text-muted">
          {camera.modules.map((m) => MODULE_LABEL[m] ?? m).join(" · ")}
          {camera.owner ? ` · ${camera.owner}` : ""}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge status={healthOf(camera)} />
        {counted && isOnline(camera) ? <Badge status={DENSITY[camera.density_level ?? "tidak_diketahui"]} /> : null}
      </div>
      <SnapshotView camera={camera} />
      {counted && isOnline(camera) ? <CountSummary camera={camera} /> : null}
      <Link href={`/kamera/${camera.id}`} className="inline-block text-sm font-medium text-primary underline">
        Lihat detail kamera
      </Link>
    </div>
  );
}

export function CountSummary({ camera }: { camera: CameraOverview }) {
  return (
    <dl className="grid grid-cols-3 gap-2 text-sm">
      <div>
        <dt className="text-xs text-muted">Kendaraan terdeteksi</dt>
        <dd className="font-semibold tabular-nums">{camera.vehicle_count ?? "–"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Orang terdeteksi</dt>
        <dd className="font-semibold tabular-nums">{camera.person_count ?? "–"}</dd>
      </div>
      <div>
        <dt className="text-xs text-muted">Indeks kepadatan</dt>
        <dd className="font-semibold tabular-nums">
          {camera.density_index != null ? `${camera.density_index.toFixed(2)}×` : "–"}
        </dd>
      </div>
      <p className="col-span-3 text-xs text-muted">
        Angka dari satu gambar terakhir, bukan hitungan presisi. Indeks membandingkan dengan kamera ini pada jam yang
        sama di hari-hari sebelumnya
        {camera.baseline_is_provisional ? " (pembanding sementara: kurang dari tiga hari data)" : ""}.
      </p>
    </dl>
  );
}
