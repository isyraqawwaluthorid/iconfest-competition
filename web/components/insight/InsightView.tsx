"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { Stat } from "@/components/ui/Stat";
import { useLiveAlerts, useLiveCameras } from "@/lib/hooks";
import {
  citySituation,
  cityStats,
  formatNumber,
  hasDensity,
  hasWaterStatus,
  summarizeDistricts,
  themeLegend,
  themeSources,
  THEMES,
  type CityStat,
  type Theme,
} from "@/lib/insight";
import { ALERT, DENSITY, NOT_ASSESSED, RISK, TONE_BG, TREND_LABEL, WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";
import type { Alert, CameraOverview, GridWeather } from "@/lib/types";
import { DistrictPanel } from "./DistrictPanel";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const ThematicMap = dynamic(() => import("./ThematicMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const TOP_COUNT = 5;
const STAT_ICON: Record<CityStat["id"], IconName> = { water: "droplet", rain: "rain", traffic: "car", coverage: "map" };

type Props = { initialCameras: CameraOverview[]; initialAlerts: Alert[]; weather: GridWeather[] };

/** Beranda: kondisi kota lebih dulu (ringkasan, angka utama, peta tematik), kamera hanya sebagai sumber data. */
export function InsightView({ initialCameras, initialAlerts, weather }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const alerts = useLiveAlerts(initialAlerts);
  const [theme, setTheme] = useState<Theme>("risk");
  const [selected, setSelected] = useState<string | null>(null);

  const summaries = useMemo(() => summarizeDistricts(cameras, weather), [cameras, weather]);
  const situation = useMemo(() => citySituation(cameras, weather), [cameras, weather]);
  const stats = useMemo(() => cityStats(cameras, weather, summaries), [cameras, weather, summaries]);
  const sources = useMemo(() => themeSources(cameras, theme), [cameras, theme]);
  const selectedSummary = summaries.find((s) => s.district.name === selected) ?? null;
  const activeTheme = THEMES.find((t) => t.id === theme) ?? THEMES[0];
  const latest = cameras.reduce<string | null>(
    (max, c) => (c.status_updated_at && (!max || c.status_updated_at > max) ? c.status_updated_at : max),
    null,
  );

  const riskiest = cameras
    .filter(hasWaterStatus)
    .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
    .slice(0, TOP_COUNT);
  const busiest = cameras
    .filter(hasDensity)
    .sort((a, b) => (b.density_index ?? 0) - (a.density_index ?? 0))
    .slice(0, TOP_COUNT);

  return (
    <div className="space-y-5">
      {/* Pola arsiran untuk kecamatan tanpa sumber data; dirujuk dari CSS peta lewat url(#untracked-stripes). */}
      <svg aria-hidden width="0" height="0" className="absolute">
        <defs>
          <pattern id="untracked-stripes" patternUnits="userSpaceOnUse" width="7" height="7" patternTransform="rotate(45)">
            <rect width="7" height="7" style={{ fill: "var(--neutral-bg)" }} />
            <line x1="0" y1="0" x2="0" y2="7" strokeWidth="3" style={{ stroke: "var(--untracked)" }} />
          </pattern>
        </defs>
      </svg>

      <section aria-label="Kondisi kota sekarang" className={`tint tone-${situation.tone} accent-left rounded-token p-5`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="label-caps">Kondisi kota sekarang</p>
          <FreshnessTag at={latest} />
        </div>
        <h2 className="mt-1 text-2xl font-extrabold">{situation.headline}</h2>
        <p className="mt-1 max-w-3xl">{situation.points.join(" ")}</p>
      </section>

      <section aria-label="Angka utama" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((stat) => (
          <Stat
            key={stat.id}
            label={stat.label}
            value={stat.value}
            unit={stat.unit}
            hint={stat.hint}
            icon={<Icon name={STAT_ICON[stat.id]} />}
          />
        ))}
      </section>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Peta kondisi per kecamatan</h2>
            <p className="mt-0.5 text-sm text-muted">{activeTheme.explain}</p>
          </div>
          <div className="inline-flex flex-wrap gap-1 rounded-control bg-surface-muted p-1" role="group" aria-label="Tema peta">
            {THEMES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === theme}
                onClick={() => setTheme(item.id)}
                className={`rounded-[6px] px-3 py-1.5 text-sm transition-colors ${
                  item.id === theme ? "bg-surface font-semibold text-primary shadow-card" : "font-medium text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div>
            <div className="h-[56vh] min-h-80 overflow-hidden rounded-token border border-border lg:h-[34rem]">
              <ThematicMap summaries={summaries} theme={theme} sources={sources} selected={selected} onSelect={setSelected} />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted" aria-label="Keterangan warna wilayah">
              {themeLegend(theme).map((item) => (
                <li key={item.label} className="flex items-center gap-1.5">
                  <span
                    aria-hidden
                    className={`h-3 w-3 rounded-[3px] border border-border ${
                      item.tone === "untracked" ? "swatch-untracked" : TONE_BG[item.tone]
                    }`}
                  />
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <aside className="lg:max-h-[37rem] lg:overflow-y-auto">
            {selectedSummary ? (
              <DistrictPanel summary={selectedSummary} onClose={() => setSelected(null)} />
            ) : (
              <AlertList alerts={alerts} />
            )}
          </aside>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Lokasi air menurut risiko">
          {riskiest.length === 0 ? (
            <p className="text-sm text-muted">Belum ada lokasi air yang dinilai.</p>
          ) : (
            <ol className="divide-y divide-border text-sm">
              {riskiest.map((site, index) => (
                <RankRow
                  key={site.id}
                  rank={index + 1}
                  href={`/kamera/${site.id}`}
                  name={site.name}
                  detail={`${site.water_status ? WATER[site.water_status].label : NOT_ASSESSED.label}${
                    site.water_trend ? `, ${TREND_LABEL[site.water_trend]}` : ""
                  }${site.risk_score != null ? ` · skor ${formatNumber(site.risk_score, 2)}` : ""}`}
                  badge={site.risk_level ? <Badge status={RISK[site.risk_level]} /> : null}
                />
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">
            Skor 0–1 dari status air (40%), tren (20%), kondisi hulu (20%), dan prakiraan hujan 3 jam (20%). Bukan
            pengukuran tinggi air.
          </p>
        </Card>

        <Card title="Lalu lintas paling padat dibanding kebiasaannya">
          {busiest.length === 0 ? (
            <p className="text-sm text-muted">Belum ada titik lalu lintas yang punya pembanding.</p>
          ) : (
            <ol className="divide-y divide-border text-sm">
              {busiest.map((site, index) => (
                <RankRow
                  key={site.id}
                  rank={index + 1}
                  href={`/kamera/${site.id}`}
                  name={site.name}
                  detail={`${formatNumber(site.density_index ?? 0, 2)}× kebiasaan · ${site.vehicle_count ?? 0} kendaraan terdeteksi`}
                  badge={<Badge status={DENSITY[site.density_level ?? "tidak_diketahui"]} />}
                />
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">
            Indeks kepadatan relatif: jumlah kendaraan pada gambar terakhir dibanding median titik itu sendiri.
          </p>
        </Card>
      </div>
    </div>
  );
}

function AlertList({ alerts }: { alerts: Alert[] }) {
  return (
    <div className="space-y-4 text-sm">
      <div>
        <p className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name="alert" size={14} /> Peringatan aktif
        </p>
        {alerts.length === 0 ? (
          <div className="tint tone-normal accent-left mt-2 rounded-control p-3">
            <p className="font-semibold">Tidak ada peringatan aktif</p>
            <p className="mt-1 text-xs">
              Peringatan muncul otomatis saat status air naik, hujan lebat diprakirakan, atau lokasi unggulan tidak
              terpantau.
            </p>
          </div>
        ) : (
          <ul className="mt-2 space-y-2">
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
        )}
      </div>
      <p className="rounded-control border border-dashed border-border p-3 text-muted">
        Ketuk satu kecamatan di peta untuk melihat kondisi air, lalu lintas, dan hujannya.
      </p>
    </div>
  );
}

function RankRow(props: { rank: number; href: string; name: string; detail: string; badge: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 py-2.5">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
        {props.rank}
      </span>
      <div className="min-w-0 flex-1">
        <Link href={props.href} className="font-semibold underline-offset-2 hover:text-primary hover:underline">
          {props.name}
        </Link>
        <p className="text-xs text-muted tabular-nums">{props.detail}</p>
      </div>
      {props.badge}
    </li>
  );
}
