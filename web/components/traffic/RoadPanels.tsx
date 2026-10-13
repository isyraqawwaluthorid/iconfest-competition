"use client";

import { useState } from "react";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { useNow } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import { DENSITY, HEALTH, isOnline, TONE_BG } from "@/lib/status";
import { formatDateTimeWib, minutesSince } from "@/lib/time";
import type { RoadRow, TrafficSituation } from "@/lib/traffic";
import { SegmentPanel } from "./SegmentPanel";
import { PANEL_BOTTOM, PANEL_LEFT, PANEL_RIGHT } from "./layout";

const TOP_COUNT = 8;
const STALE_AFTER_MINUTES = 15; // tiga siklus worker; sama dengan beranda dan banner sistem
const LEGEND = [
  DENSITY.lancar,
  DENSITY.normal,
  DENSITY.ramai,
  DENSITY.padat,
  DENSITY.tidak_diketahui,
  { ...HEALTH.dead, label: "Kamera mati" },
];

type Props = {
  rows: RoadRow[];
  situation: TrafficSituation;
  /** Waktu pembaruan status kamera yang paling baru. */
  latest: string | null;
  selected: string | null;
  onSelect: (cameraId: string | null) => void;
};

/** Panel lapisan "Ruas jalan". Kiri: kondisi sekarang. Kanan: ruas terpadat, atau rincian ruas yang dipilih. */
export function RoadPanels({ rows, situation, latest, selected, onSelect }: Props) {
  const [showAll, setShowAll] = useState(false);
  const now = useNow();
  // Data yang tidak diperbarui lebih dari tiga siklus dianggap tertunda: warna terakhir tetap tampil di peta,
  // tetapi tidak lagi disebut sebagai keadaan "sekarang".
  const outdated = now !== null && latest !== null && minutesSince(latest, now) > STALE_AFTER_MINUTES;
  const selectedRow = rows.find((row) => row.camera.id === selected) ?? null;
  const measured = rows.filter((row) => row.measured);
  // Selagi pembanding belum ada (sistem baru mulai, atau model penghitung baru diganti), daftar tetap berguna:
  // ruas diurutkan menurut jumlah kendaraan yang terlihat, tanpa menyebutnya lancar atau padat.
  const uncompared = measured.length === 0;
  const byCount = [...rows].filter((row) => isOnline(row.camera)).sort((a, b) => (b.camera.vehicle_count ?? 0) - (a.camera.vehicle_count ?? 0));
  const listed = showAll ? rows : (uncompared ? byCount : measured).slice(0, TOP_COUNT);

  return (
    <>
      <div className={PANEL_BOTTOM}>
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
            Dibanding kebiasaan pada jam yang sama, bukan kecepatan. Garis tebal: terlihat kamera. Garis tipis: perkiraan
            dari kamera terdekat, makin pudar makin jauh.
          </p>
        </div>
      </div>

      <div className={PANEL_LEFT}>
        <section aria-label="Lalu lintas sekarang" className="map-panel relative overflow-hidden">
          <div className={`tint tone-${outdated ? "unknown" : situation.tone} p-4`}>
            <p className="label-caps">{outdated ? "Data tertunda" : "Lalu lintas sekarang"}</p>
            <h1 className="mt-1 text-xl leading-tight font-extrabold">
              {outdated && latest ? `Belum ada pembaruan sejak ${formatDateTimeWib(latest)}` : situation.headline}
            </h1>
            <p className="mt-1.5 text-sm">
              {outdated
                ? `Sistem sedang tidak mengirim data, jadi keadaan sekarang tidak diketahui. Warna di peta adalah keadaan terakhir yang tercatat: ${situation.headline.toLowerCase()}.`
                : situation.detail}
            </p>
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

      <div className={PANEL_RIGHT}>
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          <div className="overflow-y-auto p-4">
            {selectedRow ? (
              <SegmentPanel key={selectedRow.camera.id} row={selectedRow} onClose={() => onSelect(null)} />
            ) : (
              <RoadList
                rows={listed}
                total={rows.length}
                showAll={showAll}
                uncompared={uncompared}
                onToggle={() => setShowAll((all) => !all)}
                onSelect={onSelect}
              />
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

type RoadListProps = {
  rows: RoadRow[];
  total: number;
  showAll: boolean;
  /** Belum ada ruas yang punya pembanding: daftar diurutkan menurut jumlah kendaraan terlihat. */
  uncompared: boolean;
  onToggle: () => void;
  onSelect: (cameraId: string) => void;
};

/** Daftar ruas, yang paling padat lebih dulu. Memilih satu ruas mendekatkan peta ke ruas itu. */
function RoadList({ rows, total, showAll, uncompared, onToggle, onSelect }: RoadListProps) {
  return (
    <div className="text-sm">
      <p className="label-caps text-muted">{showAll ? "Semua ruas" : uncompared ? "Kendaraan terbanyak terlihat sekarang" : "Ruas terpadat sekarang"}</p>
      {rows.length === 0 ? (
        <p className="mt-3 text-muted">Kamera lalu lintas sedang tidak mengirim gambar.</p>
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
                {/* Tanpa pembanding, lencana "belum ada pembanding" di tiap baris hanya mengulang judul panel kiri;
                    yang ditampilkan adalah jumlah kendaraan yang terlihat. */}
                {uncompared && !showAll && isOnline(camera) ? (
                  <span className="shrink-0 text-right">
                    <span className="block font-display text-lg leading-none font-bold tabular-nums">{camera.vehicle_count ?? 0}</span>
                    <span className="block text-[11px] text-muted">kendaraan</span>
                  </span>
                ) : (
                  <Badge status={status} />
                )}
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
