import { WATER } from "@/lib/status";
import { snapshotUrl } from "@/lib/storage";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import type { CameraOverview, ReferenceLine, WaterReading } from "@/lib/types";
import { EvidenceFrame } from "./EvidenceFrame";

type Props = {
  camera: CameraOverview;
  lines: ReferenceLine[];
  /** Foto referensi kondisi normal yang sesuai waktu (siang atau malam). */
  reference: { path: string; kind: "siang" | "malam" } | null;
  readings: WaterReading[];
};

const MAX_HISTORY = 6;

/** Pembanding visual: kondisi normal di sebelah kondisi sekarang, lalu gambar-gambar yang pernah dinilai AI. */
export function EvidenceCompare({ camera, lines, reference, readings }: Props) {
  const history = readings.filter((reading) => reading.snapshot_path).slice(0, MAX_HISTORY);
  const now = camera.latest_snapshot_path
    ? { src: snapshotUrl(camera.latest_snapshot_path, camera.latest_snapshot_at), at: camera.latest_snapshot_at }
    : null;
  const status = camera.water_status ? WATER[camera.water_status] : null;

  return (
    <div className="space-y-5">
      {reference && now ? (
        <div className="grid gap-4 md:grid-cols-2">
          <EvidenceFrame
            src={snapshotUrl(reference.path)}
            alt={`Foto referensi kondisi normal ${camera.name}`}
            label={`Kondisi normal · referensi ${reference.kind}`}
            tone="normal"
            lines={lines}
            caption="Foto pembanding yang dipilih saat kalibrasi. AI menilai gambar baru terhadap foto ini."
          />
          <EvidenceFrame
            src={now.src}
            alt={`Gambar terbaru ${camera.name}`}
            label={`Saat ini${now.at ? ` · ${formatTimeWib(now.at)}` : ""}`}
            tone={status?.tone ?? "unknown"}
            lines={lines}
            caption={
              status
                ? `Status terkonfirmasi: ${status.label}. Bandingkan posisi air terhadap garis yang sama di kedua gambar.`
                : "Status belum ditetapkan. Bandingkan posisi air terhadap garis yang sama di kedua gambar."
            }
          />
        </div>
      ) : (
        <p className="rounded-control bg-surface-muted p-3 text-sm text-muted">
          Belum ada foto referensi kondisi normal untuk kamera ini, jadi pembanding berdampingan belum bisa ditampilkan.
        </p>
      )}

      <div>
        <p className="label-caps text-muted">Gambar yang dinilai AI sebelumnya</p>
        {history.length === 0 ? (
          <p className="mt-2 rounded-control bg-surface-muted p-3 text-sm text-muted">
            Gambar bukti mulai disimpan sejak 11 Okt malam. Gambar pertama muncul setelah penilaian berikutnya (paling
            lama 30 menit) dan disimpan selama 3 hari.
          </p>
        ) : (
          <ol className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {history.map((reading) => (
              <li key={reading.captured_at}>
                <EvidenceFrame
                  src={snapshotUrl(reading.snapshot_path as string)}
                  alt={`Gambar ${camera.name} pada ${formatDateTimeWib(reading.captured_at)}`}
                  label={formatTimeWib(reading.captured_at).replace(" WIB", "")}
                  tone={WATER[reading.status].tone}
                  lines={lines}
                  caption={WATER[reading.status].label}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}
