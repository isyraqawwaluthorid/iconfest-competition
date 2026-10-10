import { FreshnessTag } from "@/components/system/FreshnessTag";
import { isOnline } from "@/lib/status";
import { snapshotUrl } from "@/lib/storage";
import { formatDateTimeWib } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";

type Props = { camera: Pick<CameraOverview, "name" | "health" | "latest_snapshot_path" | "latest_snapshot_at" | "last_live_at"> };

/** Snapshot terbaru kamera. Saat kamera offline, snapshot terakhir tetap tampil dengan keterangan waktunya. */
export function SnapshotView({ camera }: Props) {
  const online = isOnline(camera);
  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-token border border-border bg-border">
        {camera.latest_snapshot_path ? (
          // Snapshot berganti tiap 5 menit dan sudah berukuran web; next/image hanya akan menambah beban optimasi.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl(camera.latest_snapshot_path, camera.latest_snapshot_at)}
            alt={`Snapshot kamera ${camera.name}`}
            className={`h-full w-full object-cover ${online ? "" : "opacity-60 grayscale"}`}
          />
        ) : (
          <p className="flex h-full items-center justify-center p-4 text-center text-sm text-muted">
            Belum ada snapshot. Kamera ini belum pernah berhasil diambil gambarnya.
          </p>
        )}
        {!online && camera.latest_snapshot_path ? (
          <p className="absolute inset-x-0 bottom-0 bg-status-offline px-3 py-1.5 text-xs text-on-primary">
            {camera.last_live_at ? `Offline sejak ${formatDateTimeWib(camera.last_live_at)}` : "Kamera offline"}
            {" · menampilkan snapshot terakhir"}
          </p>
        ) : null}
      </div>
      <figcaption className="mt-1 flex items-center justify-between gap-2">
        <FreshnessTag at={camera.latest_snapshot_at} prefix="Gambar diambil" />
        <span className="text-xs text-muted">Sumber: PANTAUSEMAR, Pemerintah Kota Semarang</span>
      </figcaption>
    </figure>
  );
}
