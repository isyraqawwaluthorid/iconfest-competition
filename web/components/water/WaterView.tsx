"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProgressTimeline } from "@/components/insight/ProgressTimeline";
import { MapThemeToggle } from "@/components/map/MapThemeToggle";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { PANEL_BOTTOM, PANEL_LEFT, PANEL_RIGHT } from "@/components/traffic/layout";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveCameras, useLiveReadings, useNow } from "@/lib/hooks";
import { formatNumber, hasTrashStatus, rainDisplay } from "@/lib/insight";
import { mapThemeClass, useMapTheme } from "@/lib/map-theme";
import { siteProgress } from "@/lib/progress";
import { HEALTH, NOT_ASSESSED, TONE_BG, WATER } from "@/lib/status";
import { formatDateTimeWib, minutesSince } from "@/lib/time";
import type { CameraOverview, GridWeather, SiteReading } from "@/lib/types";
import { waterRows, waterSituation, wettest, type RiverLink, type WaterRow } from "@/lib/water";
import { SitePanel } from "./SitePanel";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const WaterMap = dynamic(() => import("./WaterMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const TOP_COUNT = 8;
const STALE_AFTER_MINUTES = 15; // tiga siklus worker; sama dengan beranda dan banner sistem
const LEGEND = [WATER.normal, WATER.waspada, WATER.siaga, WATER.awas, NOT_ASSESSED, { ...HEALTH.dead, label: "Kamera mati" }];

type Props = {
  initialCameras: CameraOverview[];
  initialReadings: SiteReading[];
  weather: GridWeather[];
  links: RiverLink[];
  /** Jumlah kejadian yang masih berlangsung, untuk tautan ke Riwayat. */
  openEvents: number;
};

/**
 * Halaman Air: peta memenuhi layar dengan satu pin per lokasi air. Kiri: kondisi sekarang, hujan, dan pasangan
 * hulu → hilir. Kanan: lokasi yang paling perlu diperhatikan, atau rincian lokasi yang dipilih.
 */
export function WaterView({ initialCameras, initialReadings, weather, links, openEvents }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const readings = useLiveReadings(initialReadings);
  const now = useNow();
  const mapTheme = useMapTheme();
  const [selected, setSelected] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);

  const progress = useMemo(() => (now === null ? [] : siteProgress(cameras, readings, now)), [cameras, readings, now]);
  const progressBySite = useMemo(() => new Map(progress.map((item) => [item.camera.id, item] as const)), [progress]);
  const rows = useMemo(() => waterRows(cameras, progressBySite), [cameras, progressBySite]);
  const situation = useMemo(() => waterSituation(rows), [rows]);
  const byId = useMemo(() => new Map(rows.map((row) => [row.camera.id, row] as const)), [rows]);
  const selectedRow = selected ? (byId.get(selected) ?? null) : null;
  const listed = showAll ? rows : rows.slice(0, TOP_COUNT);
  const rain = wettest(weather);
  const trash = useMemo(() => {
    const rated = rows.filter((row) => hasTrashStatus(row.camera));
    return {
      heavy: rated.filter((row) => row.camera.trash === "banyak"),
      some: rated.filter((row) => row.camera.trash === "sedikit").length,
      none: rated.filter((row) => row.camera.trash === "tidak_terlihat").length,
    };
  }, [rows]);
  const latest = rows.reduce<string | null>(
    (max, { camera }) => (camera.status_updated_at && (!max || camera.status_updated_at > max) ? camera.status_updated_at : max),
    null,
  );
  // Data yang tidak diperbarui lebih dari tiga siklus dianggap tertunda dan tidak lagi disebut keadaan "sekarang".
  const outdated = now !== null && latest !== null && minutesSince(latest, now) > STALE_AFTER_MINUTES;

  return (
    <div className="relative flex flex-1 flex-col lg:min-h-[40rem]">
      <section aria-label="Peta lokasi air" className={`relative h-[60dvh] min-h-96 lg:absolute lg:inset-0 lg:h-auto ${mapThemeClass(mapTheme)}`}>
        <WaterMap rows={rows} selected={selected} onSelect={setSelected} />
        <div className="map-panel absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 p-1">
          <Link
            href="/"
            className="rounded-control px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-muted hover:text-text"
          >
            ← Beranda
          </Link>
          <span aria-hidden className="h-5 w-px bg-border" />
          <MapThemeToggle />
        </div>
      </section>

      <div className={PANEL_BOTTOM}>
        <div className="map-panel relative px-3 py-2">
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs" aria-label="Keterangan warna lokasi">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-3 w-3 rounded-full ${TONE_BG[item.tone]}`} />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-center text-[11px] text-muted">
            Status resmi dari dua penilaian AI yang sepakat atas gambar kamera. Bukan pengukuran tinggi air.
          </p>
        </div>
      </div>

      <div className={PANEL_LEFT}>
        <section aria-label="Kondisi air sekarang" className="map-panel relative overflow-hidden">
          <div className={`tint tone-${outdated ? "unknown" : situation.tone} p-4`}>
            <p className="label-caps">{outdated ? "Data tertunda" : "Kondisi air sekarang"}</p>
            <h1 className="mt-1 text-xl leading-tight font-extrabold">
              {outdated && latest ? `Belum ada pembaruan sejak ${formatDateTimeWib(latest)}` : situation.headline}
            </h1>
            <p className="mt-1.5 text-sm">
              {outdated
                ? `Sistem sedang tidak mengirim data, jadi keadaan sekarang tidak diketahui. Keadaan terakhir yang tercatat: ${situation.headline.toLowerCase()}.`
                : situation.detail}
            </p>
          </div>
          <div className="p-4">
            <dl className="grid grid-cols-4 gap-2 text-center">
              {situation.counts.map(({ level, status, count }) => (
                <div key={level}>
                  <dd className="font-display text-2xl font-bold tabular-nums">{count}</dd>
                  <dt className="flex items-center justify-center gap-1 text-[11px] font-semibold text-muted">
                    <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_BG[status.tone]}`} />
                    {status.label}
                  </dt>
                </div>
              ))}
            </dl>

            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted">Hujan 3 jam ke depan</p>
              {rain ? (
                <p className="mt-1 text-sm">
                  <span className="font-display text-xl font-bold tabular-nums">{formatNumber(rain.precip_next_3h_mm, 1)}</span> mm paling
                  tinggi, di {rain.name}. <span className="text-muted">{rainDisplay(rain.precip_next_3h_mm).label}.</span>
                </p>
              ) : (
                <p className="mt-1 text-sm text-muted">Data hujan belum tersedia.</p>
              )}
            </div>

            <div className="mt-3 border-t border-border pt-3">
              <p className="text-xs font-semibold text-muted">Sampah di perairan</p>
              <p className="mt-1 text-sm">
                <span className="font-display text-xl font-bold tabular-nums">{trash.heavy.length}</span> lokasi bersampah banyak,{" "}
                {trash.some} sedikit, {trash.none} tidak terlihat.
              </p>
              {trash.heavy.length > 0 ? (
                <p className="mt-1.5 flex flex-wrap gap-1.5 text-xs">
                  {trash.heavy.map((row) => (
                    <SiteChip key={row.camera.id} row={row} onSelect={setSelected} />
                  ))}
                </p>
              ) : null}
              <p className="mt-1.5 text-[11px] text-muted">
                Dinilai AI dari gambar kamera dalam tiga tingkat; &quot;banyak&quot; baru berlaku bila sebagian besar penilaian terakhir
                sepakat. Bukan ukuran berat atau volume.
              </p>
            </div>

            {links.length > 0 ? (
              <div className="mt-3 border-t border-border pt-3">
                <p className="text-xs font-semibold text-muted">Hulu → hilir yang dipantau</p>
                <ul className="mt-1.5 space-y-2">
                  {links.map((link) => {
                    const up = byId.get(link.upstream_camera_id);
                    const down = byId.get(link.downstream_camera_id);
                    if (!up || !down) return null;
                    return (
                      <li key={`${link.upstream_camera_id}-${link.downstream_camera_id}`} className="text-xs">
                        <p className="font-semibold">{link.river_system}</p>
                        <p className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <SiteChip row={up} onSelect={setSelected} />
                          <span aria-hidden className="text-muted">
                            →
                          </span>
                          <SiteChip row={down} onSelect={setSelected} />
                          <span className="text-muted">
                            ±{link.lag_minutes} menit{link.learned ? "" : " (perkiraan awal)"}
                          </span>
                        </p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
              <p>
                {situation.assessed} lokasi dinilai AI{situation.unassessed > 0 ? `, ${situation.unassessed} belum (bukan lokasi unggulan)` : ""}.{" "}
                {openEvents > 0 ? (
                  <Link href="/riwayat" className="font-semibold text-primary hover:underline">
                    {openEvents} kejadian sedang berlangsung
                  </Link>
                ) : (
                  <Link href="/riwayat" className="text-primary hover:underline">
                    Riwayat kejadian
                  </Link>
                )}
              </p>
              <FreshnessTag at={latest} />
            </div>
          </div>
        </section>
        {now !== null ? <ProgressTimeline rows={progress} now={now} simulated={false} /> : null}
      </div>

      <div className={PANEL_RIGHT}>
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          <div className="overflow-y-auto p-4 text-sm">
            {selectedRow ? (
              <SitePanel
                key={selectedRow.camera.id}
                row={selectedRow}
                progress={progressBySite.get(selectedRow.camera.id)}
                links={links}
                cameras={cameras}
                onSelect={setSelected}
                onClose={() => setSelected(null)}
              />
            ) : (
              <>
                <p className="label-caps text-muted">{showAll ? "Semua lokasi air" : "Paling perlu diperhatikan"}</p>
                <ol className="mt-1 divide-y divide-border">
                  {listed.map(({ camera, status, assessed, pending }, index) => (
                    <li key={camera.id}>
                      <button type="button" onClick={() => setSelected(camera.id)} className="flex w-full items-center gap-2.5 py-2.5 text-left hover:text-primary">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{camera.name}</span>
                          <span className="block truncate text-xs text-muted tabular-nums">
                            {pending
                              ? `Indikasi awal ${WATER[pending].label.toLowerCase()}, menunggu penilaian kedua`
                              : assessed
                                ? `Skor risiko ${formatNumber(camera.risk_score ?? 0, 2)}${camera.trash === "banyak" ? " · sampah banyak" : ""}`
                                : "Belum dinilai AI"}
                          </span>
                        </span>
                        <Badge status={status} />
                      </button>
                    </li>
                  ))}
                </ol>
                {rows.length > TOP_COUNT ? (
                  <button
                    type="button"
                    onClick={() => setShowAll((all) => !all)}
                    className="mt-3 w-full rounded-control border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
                  >
                    {showAll ? "Tampilkan delapan teratas saja" : `Tampilkan semua ${rows.length} lokasi`}
                  </button>
                ) : null}
                <p className="mt-3 rounded-control border border-dashed border-border p-3 text-xs text-muted">
                  Pilih satu lokasi di daftar atau di peta untuk melihat gambar kameranya dengan garis acuan, rincian skor risiko,
                  dan hubungan hulu–hilirnya.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

/** Nama lokasi dengan titik warna statusnya; mengkliknya membuka rincian lokasi itu. */
function SiteChip({ row, onSelect }: { row: WaterRow; onSelect: (cameraId: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(row.camera.id)}
      title={row.status.label}
      className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 hover:border-primary hover:text-primary"
    >
      <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_BG[row.status.tone]}`} />
      {row.camera.name}
    </button>
  );
}
