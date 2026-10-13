"use client";

import Link from "next/link";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { PendingReading, ReadingHistory } from "@/components/insight/PendingReading";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { isRaisedSite, nearbySentence, nearbyTraffic } from "@/lib/cross-module";
import { useCalibration } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import type { SiteProgress } from "@/lib/progress";
import { RISK, TREND_LABEL } from "@/lib/status";
import { formatDateTimeWib } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";
import type { RiverLink, WaterRow } from "@/lib/water";
import { RiskBreakdown } from "./RiskBreakdown";

type Props = {
  row: WaterRow;
  /** Perkembangan penilaian lokasi ini bila sedang bergerak (indikasi awal, naik, atau baru berubah). */
  progress: SiteProgress | undefined;
  links: RiverLink[];
  /** Semua kamera kota, untuk nama lokasi hulu/hilir dan lalu lintas di sekitarnya. */
  cameras: CameraOverview[];
  onSelect: (cameraId: string) => void;
  onClose: () => void;
};

/** Rincian satu lokasi air: status resmi, bukti gambar dengan garis acuannya, rincian risiko, dan hubungan hulu–hilir. */
export function SitePanel({ row, progress, links, cameras, onSelect, onClose }: Props) {
  const { camera, status, assessed, pending } = row;
  const calibration = useCalibration(camera.id);
  const byId = new Map(cameras.map((item) => [item.id, item]));
  const upstream = links.filter((link) => link.downstream_camera_id === camera.id);
  const downstream = links.filter((link) => link.upstream_camera_id === camera.id);
  const around = isRaisedSite(camera) ? nearbyTraffic(camera, cameras) : null;
  const relation = (id: string, text: string) => {
    const other = byId.get(id);
    return other ? (
      <li key={`${id}-${text}`}>
        {text}{" "}
        <button type="button" onClick={() => onSelect(id)} className="font-semibold underline underline-offset-2 hover:text-primary">
          {other.name}
        </button>
      </li>
    ) : null;
  };

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-muted">Lokasi air{camera.river_system ? ` · ${camera.river_system}` : ""}</p>
          <h2 className="mt-1 text-xl leading-tight font-extrabold">{camera.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup rincian lokasi"
          className="shrink-0 rounded-control border border-border p-1.5 text-muted hover:border-primary hover:text-primary"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={`tint tone-${status.tone} accent-left rounded-control p-3`}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs">Status resmi</span>
          <Badge status={status} />
          {camera.risk_level ? <Badge status={RISK[camera.risk_level]} /> : null}
        </div>
        {assessed ? (
          <p className="mt-2 text-xs">
            {camera.water_status_since ? `Sejak ${formatDateTimeWib(camera.water_status_since)}. ` : ""}
            {camera.water_trend ? `Tren ${TREND_LABEL[camera.water_trend]}` : "Tren belum diketahui"}
            {camera.risk_score != null ? `, skor risiko ${formatNumber(camera.risk_score, 2)}.` : "."}
          </p>
        ) : (
          <p className="mt-2 text-xs">
            Lokasi ini sudah dikalibrasi tetapi belum dinilai AI (bukan lokasi unggulan), jadi kondisinya tidak diketahui.
          </p>
        )}
        {pending && progress?.latest ? (
          <PendingReading status={camera.water_status} level={pending} reading={progress.latest} simulated={false} />
        ) : null}
        {around ? <p className="mt-2 text-xs">{nearbySentence(around.cameras, around.busy, around.busiest.name, around.provisional)}</p> : null}
        {/* Status sampah resmi: baru "banyak" setelah beberapa penilaian berturut-turut sepakat, bukan dari satu gambar. */}
        {camera.trash === "banyak" ? (
          <p className="mt-2 text-xs">
            <span className="font-semibold">Sampah banyak terlihat</span> pada sebagian besar penilaian terakhir. Bila hujan lebat
            diprakirakan, sistem membuat peringatan untuk membersihkan saringan sebelum hujan.
          </p>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Bukti: gambar terakhir dengan garis acuannya</p>
        <SnapshotView camera={camera} lines={calibration?.lines ?? []} />
      </div>

      {progress ? <ReadingHistory readings={progress.readings} /> : null}

      {assessed ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Dari mana skor risikonya</p>
          <RiskBreakdown camera={camera} />
        </div>
      ) : null}

      {upstream.length + downstream.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Hulu dan hilir</p>
          <ul className="space-y-1 text-xs">
            {upstream.map((link) => relation(link.upstream_camera_id, "Air datang dari"))}
            {downstream.map((link) =>
              relation(
                link.downstream_camera_id,
                `Dalam ±${link.lag_minutes} menit (${link.learned ? "dipelajari dari kejadian" : "perkiraan awal"}) mengalir ke`,
              ),
            )}
          </ul>
        </div>
      ) : null}

      <Link href={`/kamera/${camera.id}`} className="inline-block font-semibold text-primary hover:underline">
        Riwayat penilaian dan perbandingan dengan referensi
      </Link>
    </div>
  );
}
