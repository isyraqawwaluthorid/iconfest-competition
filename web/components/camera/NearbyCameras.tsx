import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { DENSITY, healthOf, isOnline, WATER, type StatusDisplay } from "@/lib/status";
import { snapshotUrl } from "@/lib/storage";
import type { CameraOverview } from "@/lib/types";

const MAX_DISTANCE_M = 1500;
const MAX_SHOWN = 3;

function distanceMeters(a: CameraOverview, b: CameraOverview): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h));
}

function mainStatus(camera: CameraOverview): StatusDisplay {
  if (!isOnline(camera)) return healthOf(camera);
  if (camera.water_status && camera.water_status !== "tidak_dapat_dinilai") return WATER[camera.water_status];
  if (camera.density_level && camera.density_level !== "tidak_diketahui") return DENSITY[camera.density_level];
  return healthOf(camera);
}

/** Kamera lain dalam radius 1,5 km yang punya gambar, untuk memeriksa apakah kondisi di sekitar lokasi ini serupa. */
export function NearbyCameras({ camera, all }: { camera: CameraOverview; all: CameraOverview[] }) {
  const nearby = all
    // Kamera yang belum pernah menghasilkan gambar tidak bisa menjadi bukti pembanding.
    .filter((other) => other.id !== camera.id && other.latest_snapshot_path)
    .map((other) => ({ other, meters: distanceMeters(camera, other) }))
    .filter(({ meters }) => meters <= MAX_DISTANCE_M)
    .sort((a, b) => a.meters - b.meters)
    .slice(0, MAX_SHOWN);

  if (nearby.length === 0) {
    return <p className="rounded-control bg-surface-muted p-3 text-sm text-muted">Tidak ada kamera lain dalam radius 1,5 km.</p>;
  }
  return (
    <ul className="grid gap-4 sm:grid-cols-3">
      {nearby.map(({ other, meters }) => (
        <li key={other.id}>
          <Link href={`/kamera/${other.id}`} className="group block">
            <div className="relative aspect-video overflow-hidden rounded-token border border-border bg-surface-muted">
              {other.latest_snapshot_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={snapshotUrl(other.latest_snapshot_path, other.latest_snapshot_at)}
                  alt={`Snapshot kamera ${other.name}`}
                  loading="lazy"
                  className={`h-full w-full object-cover ${isOnline(other) ? "" : "opacity-60 grayscale"}`}
                />
              ) : (
                <p className="flex h-full items-center justify-center p-3 text-center text-xs text-muted">Belum ada snapshot</p>
              )}
              <span className="absolute top-2 left-2">
                <Badge status={mainStatus(other)} />
              </span>
            </div>
            <p className="mt-1.5 font-semibold group-hover:text-primary group-hover:underline">{other.name}</p>
            <p className="text-xs text-muted">
              {meters < 50 ? "Lokasi yang sama" : `${Math.round(meters / 10) * 10} m dari sini`}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  );
}
