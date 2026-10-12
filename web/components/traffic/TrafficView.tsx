"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveCameras } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import { DENSITY, HEALTH, TONE_BG } from "@/lib/status";
import { roadRows, trafficSituation, type RoadRow } from "@/lib/traffic";
import type { CameraOverview } from "@/lib/types";
import type { Scope } from "./RoadMap";
import { SegmentPanel } from "./SegmentPanel";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const RoadMap = dynamic(() => import("./RoadMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const TOP_COUNT = 8;
const SCOPES: { id: Scope; label: string }[] = [
  { id: "center", label: "Pusat kota" },
  { id: "city", label: "Seluruh kota" },
];
const LEGEND = [DENSITY.lancar, DENSITY.normal, DENSITY.ramai, DENSITY.padat, DENSITY.tidak_diketahui, { ...HEALTH.dead, label: "Kamera mati" }];

/**
 * Halaman Lalu Lintas: peta memenuhi layar, tiap kamera lalu lintas tampil sebagai ruas jalan berwarna.
 * Kiri: kondisi sekarang. Kanan: ruas terpadat, atau rincian ruas yang dipilih (peta ikut mendekat).
 */
export function TrafficView({ initialCameras }: { initialCameras: CameraOverview[] }) {
  const cameras = useLiveCameras(initialCameras);
  const rows = useMemo(() => roadRows(cameras), [cameras]);
  const situation = useMemo(() => trafficSituation(rows), [rows]);
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [scope, setScope] = useState<{ kind: Scope; at: number }>({ kind: "center", at: 0 });
  const selectedRow = rows.find((row) => row.camera.id === selected) ?? null;
  const listed = showAll ? rows : rows.filter((row) => row.measured).slice(0, TOP_COUNT);
  const latest = cameras.reduce<string | null>(
    (max, c) => (c.status_updated_at && (!max || c.status_updated_at > max) ? c.status_updated_at : max),
    null,
  );

  return (
    <div className="relative flex flex-1 flex-col lg:min-h-[40rem]">
      <section aria-label="Peta ruas jalan" className="relative h-[60dvh] min-h-96 lg:absolute lg:inset-0 lg:h-auto">
        <RoadMap rows={rows} selected={selected} scope={scope} onSelect={setSelected} />

        <div
          role="group"
          aria-label="Cakupan peta"
          className="map-panel absolute top-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 gap-1 overflow-x-auto p-1"
        >
          {SCOPES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === scope.kind}
              onClick={() => {
                setSelected(null);
                setScope((current) => ({ kind: item.id, at: current.at + 1 }));
              }}
              className={`rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                item.id === scope.kind ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <div className="px-3 pt-3 lg:absolute lg:bottom-3 lg:left-1/2 lg:z-[1001] lg:w-max lg:max-w-[calc(100%-48rem)] lg:-translate-x-1/2 lg:p-0">
        <div className="map-panel relative px-3 py-2">
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs" aria-label="Keterangan warna ruas">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-1.5 w-5 rounded-full ${TONE_BG[item.tone]}`} />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-center text-[11px] text-muted">
            Warna ruas: kendaraan terlihat dibanding kebiasaan ruas itu pada jam yang sama. Bukan kecepatan.
          </p>
        </div>
      </div>

      <div className="p-3 lg:pointer-events-none lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:w-[22rem] lg:overflow-y-auto lg:p-0 lg:[&>*]:pointer-events-auto">
        <section aria-label="Lalu lintas sekarang" className="map-panel relative overflow-hidden">
          <div className={`tint tone-${situation.tone} p-4`}>
            <p className="label-caps">Lalu lintas sekarang</p>
            <h1 className="mt-1 text-xl leading-tight font-extrabold">{situation.headline}</h1>
            <p className="mt-1.5 text-sm">{situation.detail}</p>
          </div>
          <div className="p-4">
            {situation.measured > 0 ? (
              <>
                <div className="flex h-3 overflow-hidden rounded-full" role="img" aria-label="Sebaran tingkat kepadatan ruas">
                  {situation.counts.map(({ level, status, count }) =>
                    count > 0 ? <span key={level} className={TONE_BG[status.tone]} style={{ flexGrow: count }} /> : null,
                  )}
                </div>
                <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {situation.counts.map(({ level, status, count }) => (
                    <div key={level}>
                      <dd className="font-display text-2xl font-bold tabular-nums">{count}</dd>
                      <dt className="text-[11px] font-semibold text-muted">{status.label}</dt>
                    </div>
                  ))}
                </dl>
              </>
            ) : null}
            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
              <p>
                {situation.measured} ruas dinilai
                {situation.unmeasured > 0 ? `, ${situation.unmeasured} tidak (kamera mati atau belum ada pembanding)` : ""}.
              </p>
              {situation.provisional ? (
                <p>Pembanding masih sementara (kurang dari tiga hari data), jadi hari yang sekadar lebih ramai bisa terbaca padat.</p>
              ) : null}
              <FreshnessTag at={latest} />
            </div>
          </div>
        </section>
      </div>

      <div className="p-3 pt-0 lg:absolute lg:top-3 lg:right-3 lg:bottom-3 lg:w-[23rem] lg:p-0">
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          <div className="overflow-y-auto p-4">
            {selectedRow ? (
              <SegmentPanel key={selectedRow.camera.id} row={selectedRow} onClose={() => setSelected(null)} />
            ) : (
              <RoadList rows={listed} total={rows.length} showAll={showAll} onToggle={() => setShowAll((all) => !all)} onSelect={setSelected} />
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

type RoadListProps = {
  rows: RoadRow[];
  total: number;
  showAll: boolean;
  onToggle: () => void;
  onSelect: (cameraId: string) => void;
};

/** Daftar ruas, yang paling padat lebih dulu. Memilih satu ruas mendekatkan peta ke ruas itu. */
function RoadList({ rows, total, showAll, onToggle, onSelect }: RoadListProps) {
  return (
    <div className="text-sm">
      <p className="label-caps text-muted">{showAll ? "Semua ruas" : "Ruas terpadat sekarang"}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-muted">Belum ada ruas yang bisa dinilai. Kamera lalu lintas sedang tidak mengirim gambar.</p>
      ) : (
        <ol className="mt-1 divide-y divide-border">
          {rows.map(({ camera, title, status, measured }, index) => (
            <li key={camera.id}>
              <button type="button" onClick={() => onSelect(camera.id)} className="flex w-full items-center gap-2.5 py-2.5 text-left hover:text-primary">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{title}</span>
                  <span className="block truncate text-xs text-muted tabular-nums">
                    {measured
                      ? `${formatNumber(camera.density_index ?? 0, 1)}× kebiasaan · ${camera.vehicle_count ?? 0} kendaraan · kamera ${camera.name}`
                      : `kamera ${camera.name}`}
                  </span>
                </span>
                <Badge status={status} />
              </button>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        onClick={onToggle}
        className="mt-3 w-full rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
      >
        {showAll ? "Tampilkan yang terpadat saja" : `Tampilkan semua ${total} ruas`}
      </button>
      <p className="mt-3 rounded-control border border-dashed border-border p-3 text-xs text-muted">
        Pilih satu ruas di daftar atau di peta untuk melihatnya dari dekat, beserta gambar kameranya sebagai bukti.
      </p>
    </div>
  );
}
