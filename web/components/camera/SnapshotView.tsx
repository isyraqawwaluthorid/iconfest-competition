import { FreshnessTag } from "@/components/system/FreshnessTag";
import { isOnline } from "@/lib/status";
import { snapshotUrl } from "@/lib/storage";
import { formatDateTimeWib } from "@/lib/time";
import type { CameraOverview, ReferenceLine } from "@/lib/types";

type Props = {
  camera: Pick<CameraOverview, "name" | "health" | "latest_snapshot_path" | "latest_snapshot_at" | "last_live_at">;
  /** Garis acuan kalibrasi. Jika ada, gambar ditampilkan utuh (tanpa dipotong) agar garis tepat posisinya. */
  lines?: ReferenceLine[];
};

const LEVEL_LABEL = { normal: "Normal", waspada: "Waspada", siaga: "Siaga", awas: "Awas" } as const;

/** Snapshot terbaru kamera. Saat kamera offline, snapshot terakhir tetap tampil dengan keterangan waktunya. */
export function SnapshotView({ camera, lines = [] }: Props) {
  const online = isOnline(camera);
  const withLines = lines.length > 0;
  return (
    <figure>
      <div className={`relative overflow-hidden rounded-token border border-border bg-border ${withLines ? "" : "aspect-video"}`}>
        {camera.latest_snapshot_path ? (
          <>
            {/* Snapshot berganti tiap 5 menit dan sudah berukuran web; next/image hanya akan menambah beban optimasi. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={snapshotUrl(camera.latest_snapshot_path, camera.latest_snapshot_at)}
              alt={`Snapshot kamera ${camera.name}`}
              className={`${withLines ? "block w-full" : "h-full w-full object-cover"} ${online ? "" : "opacity-60 grayscale"}`}
            />
            {withLines ? (
              <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
                {lines.map((line) => (
                  <g key={line.level} className={`level-${line.level}`}>
                    <line
                      x1={line.points[0][0]} y1={line.points[0][1]} x2={line.points[1][0]} y2={line.points[1][1]}
                      className="calib-line" vectorEffect="non-scaling-stroke"
                    />
                  </g>
                ))}
              </svg>
            ) : null}
          </>
        ) : (
          <p className="flex aspect-video items-center justify-center p-4 text-center text-sm text-muted">
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
      {withLines ? (
        <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs" aria-label="Garis acuan pada gambar">
          {lines.map((line) => (
            <li key={line.level} className="flex items-center gap-1">
              <span aria-hidden className={`inline-block h-2 w-2 rounded-full calib-swatch level-${line.level}`} />
              Garis {LEVEL_LABEL[line.level]}
            </li>
          ))}
        </ul>
      ) : null}
      <figcaption className="mt-1 flex items-center justify-between gap-2">
        <FreshnessTag at={camera.latest_snapshot_at} prefix="Gambar diambil" />
        <span className="text-xs text-muted">Sumber: PANTAUSEMAR, Pemerintah Kota Semarang</span>
      </figcaption>
    </figure>
  );
}
