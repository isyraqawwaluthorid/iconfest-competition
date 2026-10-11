"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveAlerts, useLiveCameras } from "@/lib/hooks";
import {
  citySituation,
  formatNumber,
  hasDensity,
  hasWaterStatus,
  summarizeDistricts,
  themeLegend,
  themeSources,
  THEMES,
  type Theme,
} from "@/lib/insight";
import { ALERT, DENSITY, NOT_ASSESSED, RISK, TONE_BG, TREND_LABEL, WATER } from "@/lib/status";
import { formatDateTimeWib } from "@/lib/time";
import type { Alert, CameraOverview, GridWeather } from "@/lib/types";
import { DistrictPanel } from "./DistrictPanel";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const ThematicMap = dynamic(() => import("./ThematicMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const TOP_COUNT = 5;

type Props = { initialCameras: CameraOverview[]; initialAlerts: Alert[]; weather: GridWeather[] };

/** Beranda: kondisi kota lebih dulu (ringkasan, peringatan, peta tematik), kamera hanya sebagai sumber data. */
export function InsightView({ initialCameras, initialAlerts, weather }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const alerts = useLiveAlerts(initialAlerts);
  const [theme, setTheme] = useState<Theme>("risk");
  const [selected, setSelected] = useState<string | null>(null);

  const summaries = useMemo(() => summarizeDistricts(cameras, weather), [cameras, weather]);
  const situation = useMemo(() => citySituation(cameras, weather), [cameras, weather]);
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
  const tracked = summaries.filter((s) => s.waterSites.length > 0).length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kondisi kota sekarang">
          <div className="flex items-center gap-2">
            <span aria-hidden className={`h-3 w-3 rounded-full ${TONE_BG[situation.tone]}`} />
            <p className="text-lg font-semibold">{situation.headline}</p>
          </div>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
            {situation.points.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <div className="mt-3">
            <FreshnessTag at={latest} />
          </div>
        </Card>

        <Card title={`Peringatan aktif (${alerts.length})`}>
          {alerts.length === 0 ? (
            <p className="text-sm text-muted">
              Tidak ada peringatan aktif. Peringatan muncul otomatis saat status air naik, hujan lebat diprakirakan,
              atau lokasi unggulan tidak terpantau.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {alerts.map((alert) => (
                <li key={alert.id} className="rounded-token border border-border p-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge status={ALERT[alert.level]} />
                    {alert.camera_id ? (
                      <Link href={`/kamera/${alert.camera_id}`} className="font-medium text-primary underline">
                        {alert.title}
                      </Link>
                    ) : (
                      <span className="font-medium">{alert.title}</span>
                    )}
                  </div>
                  <p className="mt-1">{alert.message}</p>
                  <p className="mt-1 text-xs text-muted">Sejak {formatDateTimeWib(alert.created_at)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <section aria-label="Peta kondisi per kecamatan" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Tema peta">
          {THEMES.map((item) => (
            <Button
              key={item.id}
              variant="ghost"
              active={item.id === theme}
              aria-pressed={item.id === theme}
              onClick={() => setTheme(item.id)}
            >
              {item.label}
            </Button>
          ))}
        </div>
        <p className="text-sm text-muted">{activeTheme.explain}</p>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Keterangan warna wilayah">
          {themeLegend(theme).map((item) => (
            <li key={item.label} className="flex items-center gap-1.5">
              <span aria-hidden className={`h-2.5 w-2.5 rounded-sm ${TONE_BG[item.tone]}`} />
              {item.label}
            </li>
          ))}
        </ul>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="h-[60vh] min-h-80 lg:h-[70vh]">
            <ThematicMap summaries={summaries} theme={theme} sources={sources} selected={selected} onSelect={setSelected} />
          </div>
          <aside className="max-h-[70vh] overflow-y-auto rounded-token border border-border bg-surface p-4">
            {selectedSummary ? (
              <DistrictPanel summary={selectedSummary} />
            ) : (
              <EmptyState
                title="Pilih kecamatan"
                reason={`Ketuk satu wilayah di peta untuk melihat kondisi air, lalu lintas, dan hujannya. Lokasi air baru terpantau di ${tracked} dari ${summaries.length} kecamatan; sisanya ditandai tidak terpantau.`}
              />
            )}
          </aside>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Lokasi air menurut risiko">
          {riskiest.length === 0 ? (
            <p className="text-sm text-muted">Belum ada lokasi air yang dinilai.</p>
          ) : (
            <ol className="space-y-2 text-sm">
              {riskiest.map((site) => (
                <li key={site.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/kamera/${site.id}`} className="font-medium text-primary underline">
                      {site.name}
                    </Link>
                    <p className="text-xs text-muted">
                      {site.water_status ? WATER[site.water_status].label : NOT_ASSESSED.label}
                      {site.water_trend ? `, ${TREND_LABEL[site.water_trend]}` : ""}
                      {site.risk_score != null ? ` · skor ${formatNumber(site.risk_score, 2)}` : ""}
                    </p>
                  </div>
                  {site.risk_level ? <Badge status={RISK[site.risk_level]} /> : null}
                </li>
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
            <ol className="space-y-2 text-sm">
              {busiest.map((site) => (
                <li key={site.id} className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link href={`/kamera/${site.id}`} className="font-medium text-primary underline">
                      {site.name}
                    </Link>
                    <p className="text-xs text-muted tabular-nums">
                      {formatNumber(site.density_index ?? 0, 2)}× kebiasaan · {site.vehicle_count ?? 0} kendaraan terdeteksi
                    </p>
                  </div>
                  <Badge status={DENSITY[site.density_level ?? "tidak_diketahui"]} />
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 text-xs text-muted">
            Indeks kepadatan relatif: jumlah kendaraan pada gambar terakhir dibanding median kamera itu sendiri.
          </p>
        </Card>
      </div>
    </div>
  );
}
