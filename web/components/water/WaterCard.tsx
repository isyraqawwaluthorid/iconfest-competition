import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { confidenceLabel, NOT_ASSESSED, TONE_BG, TRASH_LABEL, WATER } from "@/lib/status";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import type { CameraOverview, WaterReading } from "@/lib/types";

const TRIGGER_LABEL: Record<string, string> = {
  change: "gambar berubah",
  heartbeat: "pemeriksaan berkala",
  rain: "hujan",
  manual: "manual",
};

/** Kondisi air satu kamera: status terkonfirmasi, penilaian AI terakhir, dan riwayat singkatnya. */
export function WaterCard({ camera, readings }: { camera: CameraOverview; readings: WaterReading[] }) {
  if (!camera.is_calibrated) {
    return (
      <EmptyState
        title="Status air belum dinilai"
        reason="Kamera ini belum dikalibrasi. Sistem hanya menilai status air pada kamera yang garis acuannya sudah ditandai."
      />
    );
  }
  const latest = readings[0];
  if (!latest) {
    return (
      <EmptyState
        title="Belum ada penilaian"
        reason="Kamera sudah dikalibrasi. Penilaian pertama muncul dalam 30 menit setelah kamera aktif."
      />
    );
  }

  const confirmed = camera.water_status ? WATER[camera.water_status] : NOT_ASSESSED;
  return (
    <div className="space-y-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge status={confirmed} />
        {camera.water_status_since ? (
          <span className="text-xs text-muted">sejak {formatDateTimeWib(camera.water_status_since)}</span>
        ) : null}
        {camera.needs_verification ? (
          <span className="rounded-token border border-status-waspada px-2 py-0.5 text-xs">Perlu verifikasi</span>
        ) : null}
      </div>
      {!camera.water_status ? (
        <p className="text-xs text-muted">
          Status resmi baru ditetapkan setelah dua penilaian berturut-turut sepakat, supaya satu penilaian yang keliru
          tidak langsung menjadi peringatan.
        </p>
      ) : null}

      <div className="rounded-token border border-border p-3">
        <p className="text-xs text-muted">Penilaian AI terakhir</p>
        <p className="mt-1">{latest.reason || "Tanpa keterangan."}</p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <dt className="text-muted">Dinilai sebagai</dt>
          <dd>{WATER[latest.status].label}</dd>
          <dt className="text-muted">Keyakinan AI</dt>
          <dd>{confidenceLabel(latest.confidence)}</dd>
          <dt className="text-muted">Sampah di air</dt>
          <dd>{TRASH_LABEL[latest.trash]}</dd>
          <dt className="text-muted">Dipicu oleh</dt>
          <dd>{latest.trigger ? TRIGGER_LABEL[latest.trigger] : "–"}</dd>
        </dl>
        <div className="mt-2">
          <FreshnessTag at={latest.captured_at} prefix="Dinilai" />
        </div>
      </div>

      <div>
        <p className="mb-1 text-xs text-muted">Penilaian sebelumnya</p>
        <ol className="flex flex-wrap gap-1.5">
          {readings.map((reading) => (
            <li
              key={reading.captured_at}
              title={`${formatDateTimeWib(reading.captured_at)}: ${WATER[reading.status].label}`}
              className="flex items-center gap-1 rounded-token border border-border px-1.5 py-0.5 text-xs"
            >
              <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_BG[WATER[reading.status].tone]}`} />
              {formatTimeWib(reading.captured_at).replace(" WIB", "")} {WATER[reading.status].label}
            </li>
          ))}
        </ol>
      </div>
      <p className="text-xs text-muted">
        Status dinilai dari gambar terhadap garis acuan kamera ini. Ini bukan pengukuran tinggi air dalam cm.
      </p>
    </div>
  );
}
