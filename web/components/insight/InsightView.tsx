"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MapThemeToggle } from "@/components/map/MapThemeToggle";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Insight } from "@/lib/ai-insight";
import { districtOf } from "@/lib/geo/districts";
import { useLiveAlerts, useLiveCameras, useLiveInsight, useLiveReadings, useNow } from "@/lib/hooks";
import {
  citySituation,
  cityStats,
  densityNote,
  formatNumber,
  hasDensity,
  hasWaterStatus,
  summarizeDistricts,
  themeLegend,
  themeSources,
  THEMES,
  type Theme,
} from "@/lib/insight";
import { ALERT, DENSITY, isOnline, NOT_ASSESSED, RISK, TONE_BG, TREND_LABEL, WATER, type StatusDisplay } from "@/lib/status";
import { formatDateTimeWib, formatTimeWib, minutesSince } from "@/lib/time";
import { mapThemeClass, useMapTheme } from "@/lib/map-theme";
import { siteProgress } from "@/lib/progress";
import type { Alert, CameraOverview, GridWeather, SiteReading } from "@/lib/types";
import { AiInsightPanel } from "./AiInsight";
import { DistrictPanel } from "./DistrictPanel";
import { ProgressTimeline } from "./ProgressTimeline";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const ThematicMap = dynamic(() => import("./ThematicMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const TOP_COUNT = 6;
const STALE_AFTER_MINUTES = 15; // tiga siklus worker; sama dengan ambang banner sistem
type Tab = "insight" | "alerts" | "water" | "traffic";

type Props = {
  initialCameras: CameraOverview[];
  initialAlerts: Alert[];
  initialInsight: Insight | null;
  initialReadings: SiteReading[];
  weather: GridWeather[];
};

/** Beranda dengan data langsung: kamera, peringatan, dan ringkasan AI ikut berubah lewat Realtime. */
export function InsightView({ initialCameras, initialAlerts, initialInsight, initialReadings, weather }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const alerts = useLiveAlerts(initialAlerts);
  const insight = useLiveInsight(initialInsight);
  const readings = useLiveReadings(initialReadings);
  return <InsightScreen cameras={cameras} alerts={alerts} insight={insight} readings={readings} weather={weather} />;
}

type ScreenProps = {
  cameras: CameraOverview[];
  alerts: Alert[];
  insight: Insight | null;
  /** Penilaian AI terbaru per lokasi air, untuk linimasa dan penanda "menunggu konfirmasi". */
  readings: SiteReading[];
  weather: GridWeather[];
  /** Jam yang dipakai layar (ms). Diisi halaman simulasi dengan jam skenario; kosong berarti jam sebenarnya. */
  clock?: number;
};

/**
 * Layar utama: peta memenuhi layar dan semua ringkasan mengambang di atasnya sebagai panel.
 * Kiri: kondisi kota. Kanan: peringatan dan peringkat, atau rincian kecamatan yang dipilih.
 * Di layar sempit, panel turun ke bawah peta. Tidak tahu dari mana datanya berasal:
 * beranda mengisinya dengan data langsung, halaman simulasi dengan langkah skenario.
 */
export function InsightScreen({ cameras, alerts, insight, readings, weather, clock }: ScreenProps) {
  const realNow = useNow();
  const now = clock ?? realNow;
  const progress = useMemo(() => (now === null ? [] : siteProgress(cameras, readings, now)), [cameras, readings, now]);
  const progressBySite = useMemo(() => new Map(progress.map((row) => [row.camera.id, row] as const)), [progress]);
  const pendingLevels = useMemo(
    () => new Map(progress.flatMap((row) => (row.pending ? [[row.camera.id, row.pending] as const] : []))),
    [progress],
  );
  const [theme, setTheme] = useState<Theme>("risk");
  const [selected, setSelected] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("insight");
  const [summaryOpen, setSummaryOpen] = useState(true);
  const mapTheme = useMapTheme();

  const summaries = useMemo(() => summarizeDistricts(cameras, weather), [cameras, weather]);
  const situation = useMemo(() => citySituation(cameras, weather), [cameras, weather]);
  const stats = useMemo(() => cityStats(cameras, weather, summaries), [cameras, weather, summaries]);
  const sources = useMemo(() => themeSources(cameras, theme), [cameras, theme]);
  const cameraNames = useMemo(() => new Map(cameras.map((camera) => [camera.id, camera.name])), [cameras]);
  const selectedSummary = summaries.find((s) => s.district.name === selected) ?? null;
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const latest = cameras.reduce<string | null>(
    (max, c) => (c.status_updated_at && (!max || c.status_updated_at > max) ? c.status_updated_at : max),
    null,
  );

  // Data langsung yang tidak diperbarui lebih dari tiga siklus dianggap tertunda: kondisi terakhir tetap
  // ditampilkan, tetapi tidak lagi disebut sebagai kondisi "sekarang".
  const outdated = clock === undefined && now !== null && latest !== null && minutesSince(latest, now) > STALE_AFTER_MINUTES;

  const riskiest = cameras
    .filter(hasWaterStatus)
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, TOP_COUNT);
  const busiest = cameras
    .filter(hasDensity)
    .sort((a, b) => (b.density_index ?? 0) - (a.density_index ?? 0))
    .slice(0, TOP_COUNT);
  const showOnMap = (camera: CameraOverview) => {
    const district = districtOf(camera.lat, camera.lng);
    if (district) setSelected(district);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "insight", label: "Insight" },
    { id: "alerts", label: `Peringatan (${alerts.length})` },
    { id: "water", label: "Risiko air" },
    { id: "traffic", label: "Lalu lintas" },
  ];

  return (
    <div className="relative flex flex-1 flex-col lg:min-h-[40rem]">
      {/* Pola arsiran untuk kecamatan tanpa sumber data; dirujuk dari CSS peta lewat url(#untracked-stripes). */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <pattern id="untracked-stripes" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" style={{ fill: "var(--neutral-bg)" }} />
            <line x1="0" y1="0" x2="0" y2="7" strokeWidth="3" style={{ stroke: "var(--untracked)" }} />
          </pattern>
        </defs>
      </svg>

      <section
        aria-label="Peta kondisi per kecamatan"
        className={`relative h-[60dvh] min-h-96 lg:absolute lg:inset-0 lg:h-auto ${mapThemeClass(mapTheme)}`}
      >
        <ThematicMap summaries={summaries} theme={theme} sources={sources} pending={pendingLevels} selected={selected} onSelect={setSelected} />

        <div
          role="group"
          aria-label="Tema peta"
          className="map-panel absolute top-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 overflow-x-auto p-1"
        >
          {THEMES.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={item.id === theme}
              onClick={() => setTheme(item.id)}
              className={`rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
                item.id === theme ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
              }`}
            >
              {item.label}
            </button>
          ))}
          <span aria-hidden className="mx-1 h-5 w-px bg-border" />
          <MapThemeToggle />
        </div>
      </section>

      {/* Legenda: mengambang di tengah bawah peta pada layar lebar, tepat di bawah peta pada layar sempit. */}
      <div className="px-3 pt-3 lg:absolute lg:bottom-3 lg:left-1/2 lg:z-[1001] lg:w-max lg:max-w-[calc(100%-48rem)] lg:-translate-x-1/2 lg:p-0">
        <div className="map-panel relative px-3 py-2">
          <ul className="flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs" aria-label="Keterangan warna wilayah">
            {themeLegend(theme).map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span
                  aria-hidden
                  className={`h-3 w-3 rounded-[3px] border border-border ${item.tone === "untracked" ? "swatch-untracked" : TONE_BG[item.tone]}`}
                />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-center text-[11px] text-muted">{activeTheme.explain}</p>
        </div>
      </div>

      {/* Kolom kiri bisa digulir bila isinya melebihi tinggi layar; bagian kosongnya tidak menghalangi klik ke peta. */}
      <div className="p-3 lg:pointer-events-none lg:absolute lg:top-3 lg:bottom-3 lg:left-3 lg:w-[22rem] lg:overflow-y-auto lg:p-0 lg:[&>*]:pointer-events-auto">
        <section aria-label="Kondisi kota sekarang" className="map-panel relative overflow-hidden">
          <div className={`tint tone-${outdated ? "unknown" : situation.tone} p-4`}>
            <div className="flex items-center justify-between gap-2">
              <p className="label-caps">{outdated ? "Data tertunda" : "Kondisi kota sekarang"}</p>
              <button
                type="button"
                onClick={() => setSummaryOpen((open) => !open)}
                aria-expanded={summaryOpen}
                aria-label={summaryOpen ? "Ciutkan ringkasan" : "Buka ringkasan"}
                className="-m-1 rounded-control p-1 hover:bg-surface/60"
              >
                <Icon name={summaryOpen ? "chevron-up" : "chevron-down"} size={18} />
              </button>
            </div>
            <h1 className="mt-1 text-xl leading-tight font-extrabold">
              {outdated && latest ? `Belum ada pembaruan sejak ${formatDateTimeWib(latest)}` : situation.headline}
            </h1>
            {summaryOpen ? (
              <p className="mt-1.5 text-sm">
                {outdated ? "Sistem sedang tidak mengirim data, jadi keadaan sekarang tidak diketahui. Keadaan terakhir yang tercatat: " : ""}
                {situation.points.join(" ")}
              </p>
            ) : null}
          </div>
          {summaryOpen ? (
            <div className="p-4">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                {stats.map((stat) => (
                  <div key={stat.id}>
                    <dt className="text-[11px] leading-tight font-semibold text-muted">{stat.label}</dt>
                    <dd className="mt-0.5 flex items-baseline gap-1">
                      <span className="font-display text-2xl font-bold tabular-nums">{stat.value}</span>
                      <span className="text-xs text-muted">{stat.unit}</span>
                    </dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-border pt-3 text-xs text-muted">
                <FreshnessTag at={latest} />
                <span>
                  {cameras.filter(isOnline).length} dari {cameras.length} kamera aktif ·{" "}
                  <Link href="/kamera" className="text-primary hover:underline">
                    lihat
                  </Link>
                </span>
              </div>
            </div>
          ) : null}
        </section>
        {now !== null ? <ProgressTimeline rows={progress} now={now} simulated={clock !== undefined} /> : null}
      </div>

      <div className="p-3 pt-0 lg:absolute lg:top-3 lg:right-3 lg:bottom-3 lg:w-[23rem] lg:p-0">
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          {selectedSummary ? (
            <div className="overflow-y-auto p-4">
              <DistrictPanel
                summary={selectedSummary}
                insight={insight}
                cameraNames={cameraNames}
                progress={progressBySite}
                clock={clock}
                onClose={() => setSelected(null)}
              />
            </div>
          ) : (
            <>
              <div role="tablist" aria-label="Isi panel" className="flex gap-1 border-b border-border p-1.5">
                {tabs.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={item.id === tab}
                    onClick={() => setTab(item.id)}
                    className={`flex-1 rounded-control px-1.5 py-1.5 text-[13px] whitespace-nowrap transition-colors ${
                      item.id === tab ? "bg-primary-soft font-semibold text-primary-strong" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="overflow-y-auto p-4 text-sm">
                {tab === "insight" ? <AiInsightPanel insight={insight} cameraNames={cameraNames} clock={clock} /> : null}
                {tab === "alerts" ? <AlertList alerts={alerts} simulated={clock !== undefined} /> : null}
                {tab === "water" ? (
                  <Ranking
                    empty="Belum ada lokasi air yang dinilai."
                    note="Skor 0–1 dari status air (40%), tren (20%), kondisi hulu (20%), dan prakiraan hujan 3 jam (20%). Bukan pengukuran tinggi air."
                    rows={riskiest.map((site) => ({
                      camera: site,
                      detail: `${site.water_status ? WATER[site.water_status].label : NOT_ASSESSED.label}${
                        site.water_trend ? `, ${TREND_LABEL[site.water_trend]}` : ""
                      }${site.risk_score != null ? ` · skor ${formatNumber(site.risk_score, 2)}` : ""}`,
                      status: site.risk_level ? RISK[site.risk_level] : NOT_ASSESSED,
                    }))}
                    onShow={showOnMap}
                  />
                ) : null}
                {tab === "traffic" ? (
                  <Ranking
                    empty="Belum ada titik lalu lintas yang punya pembanding."
                    note={densityNote(busiest)}
                    rows={busiest.map((site) => ({
                      camera: site,
                      detail: `${formatNumber(site.density_index ?? 0, 2)}× kebiasaan · ${site.vehicle_count ?? 0} kendaraan`,
                      status: DENSITY[site.density_level ?? "tidak_diketahui"],
                    }))}
                    onShow={showOnMap}
                  />
                ) : null}
                <p className="mt-4 rounded-control border border-dashed border-border p-3 text-xs text-muted">
                  Ketuk satu kecamatan di peta untuk melihat kondisi air, lalu lintas, dan hujannya.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

function AlertList({ alerts, simulated }: { alerts: Alert[]; simulated: boolean }) {
  if (alerts.length === 0) {
    return (
      <div className="tint tone-normal accent-left rounded-control p-3">
        <p className="font-semibold">Tidak ada peringatan aktif</p>
        <p className="mt-1 text-xs">
          Peringatan muncul otomatis saat status air naik, hujan lebat diprakirakan, atau lokasi unggulan tidak
          terpantau.
        </p>
        {simulated ? null : (
          <p className="mt-2 text-xs">
            Ingin melihat seperti apa saat air naik?{" "}
            <Link href="/simulasi" className="font-semibold underline underline-offset-2">
              Buka simulasi kejadian
            </Link>
            .
          </p>
        )}
      </div>
    );
  }
  return (
    <ul className="space-y-2">
      {alerts.map((alert) => (
        <li key={alert.id} className={`tint tone-${ALERT[alert.level].tone} accent-left rounded-control p-3`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase">{ALERT[alert.level].label}</span>
            <span className="text-xs">sejak {formatTimeWib(alert.created_at)}</span>
          </div>
          {alert.camera_id ? (
            <Link href={`/kamera/${alert.camera_id}`} className="mt-1 block font-semibold underline-offset-2 hover:underline">
              {alert.title}
            </Link>
          ) : (
            <p className="mt-1 font-semibold">{alert.title}</p>
          )}
          <p className="mt-0.5 text-xs">{alert.message}</p>
        </li>
      ))}
    </ul>
  );
}

type RankingProps = {
  rows: { camera: CameraOverview; detail: string; status: StatusDisplay }[];
  empty: string;
  note: string;
  onShow: (camera: CameraOverview) => void;
};

/** Daftar peringkat lokasi. Nama membuka bukti visualnya; tombol pin menyorot kecamatannya di peta. */
function Ranking({ rows, empty, note, onShow }: RankingProps) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <>
      <ol className="divide-y divide-border">
        {rows.map(({ camera, detail, status }, index) => (
          <li key={camera.id} className="flex items-center gap-2.5 py-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
              {index + 1}
            </span>
            <div className="min-w-0 flex-1">
              <Link href={`/kamera/${camera.id}`} className="block truncate font-semibold underline-offset-2 hover:text-primary hover:underline">
                {camera.name}
              </Link>
              <p className="text-xs text-muted tabular-nums">{detail}</p>
              <div className="mt-1">
                <Badge status={status} />
              </div>
            </div>
            <button
              type="button"
              onClick={() => onShow(camera)}
              aria-label={`Tunjukkan ${camera.name} di peta`}
              title="Tunjukkan di peta"
              className="shrink-0 rounded-control border border-border p-1.5 text-muted hover:border-primary hover:text-primary"
            >
              <Icon name="pin" size={16} />
            </button>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-xs text-muted">{note}</p>
    </>
  );
}
