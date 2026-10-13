"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo, useState } from "react";
import { MapThemeToggle } from "@/components/map/MapThemeToggle";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveCameras } from "@/lib/hooks";
import { useMapTheme } from "@/lib/map-theme";
import { DENSITY, HEALTH, TONE_BG } from "@/lib/status";
import { roadRows, trafficSituation } from "@/lib/traffic";
import type { CameraOverview } from "@/lib/types";

// MapLibre membutuhkan WebGL dan `window`, jadi peta hanya dimuat di browser.
const Map3D = dynamic(() => import("./Map3D"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const LEGEND = [DENSITY.lancar, DENSITY.normal, DENSITY.ramai, DENSITY.padat, DENSITY.tidak_diketahui, { ...HEALTH.dead, label: "Kamera mati" }];

/** Percobaan tampilan 3D lapisan "Ruas jalan": data dan aturannya sama dengan versi datar, hanya petanya yang berbeda. */
export function Traffic3DView({ initialCameras }: { initialCameras: CameraOverview[] }) {
  const cameras = useLiveCameras(initialCameras);
  const theme = useMapTheme();
  const rows = useMemo(() => roadRows(cameras), [cameras]);
  const situation = useMemo(() => trafficSituation(rows), [rows]);
  const [selected, setSelected] = useState<string | null>(null);
  const row = rows.find((item) => item.camera.id === selected) ?? null;

  return (
    <div className="relative flex flex-1 flex-col lg:min-h-[40rem]">
      <section aria-label="Peta 3D ruas jalan" className="relative h-[70dvh] min-h-96 lg:absolute lg:inset-0 lg:h-auto">
        <Map3D rows={rows} theme={theme} onSelect={setSelected} />

        <div className="map-panel absolute top-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto p-1">
          <Link href="/lalu-lintas" className="rounded-control px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted hover:bg-surface-muted hover:text-text">
            ← Peta datar
          </Link>
          <span className="rounded-control bg-primary px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-on-primary">Ruas jalan 3D · percobaan</span>
          <span aria-hidden className="h-5 w-px bg-border" />
          <MapThemeToggle />
        </div>

        <div className="map-panel absolute top-16 left-3 w-[19rem] max-w-[calc(100%-1.5rem)] p-3 lg:top-3">
          <p className="label-caps text-muted">Lalu lintas sekarang</p>
          <p className="mt-1 text-base leading-tight font-extrabold">{situation.headline}</p>
          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px]" aria-label="Keterangan warna ruas">
            {LEGEND.map((item) => (
              <li key={item.label} className="flex items-center gap-1.5">
                <span aria-hidden className={`h-1.5 w-4 rounded-full ${TONE_BG[item.tone]}`} />
                {item.label}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] text-muted">
            Seret dengan tombol kanan (atau dua jari) untuk memutar dan memiringkan. Tinggi bangunan dari OpenStreetMap; yang tidak
            punya data tinggi digambar rendah. Warna jalan tanpa kamera adalah perkiraan dari kamera terdekat.
          </p>
        </div>

        {row ? (
          <div className="map-panel absolute right-3 bottom-10 w-[19rem] max-w-[calc(100%-1.5rem)] p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate font-semibold">{row.title}</p>
                <p className="truncate text-xs text-muted">kamera {row.camera.name}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} aria-label="Tutup" className="shrink-0 rounded-control px-1.5 text-muted hover:text-text">
                ×
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge status={row.status} />
              <span className="text-xs text-muted">{row.camera.vehicle_count ?? 0} kendaraan terlihat</span>
            </div>
            <Link href={`/kamera/${row.camera.id}`} className="mt-2 inline-block text-xs font-semibold text-primary hover:underline">
              Buka halaman kamera
            </Link>
          </div>
        ) : null}
      </section>
    </div>
  );
}
