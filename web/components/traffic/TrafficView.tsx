"use client";

import dynamic from "next/dynamic";
import { useCallback, useMemo, useState } from "react";
import { MapThemeToggle } from "@/components/map/MapThemeToggle";
import { Skeleton } from "@/components/ui/Skeleton";
import { activityBreaks, buildHexes, hourWib, type ActivityMetric, type ActivityProfile } from "@/lib/activity";
import { emissionRows, EMISSION_LEVELS, type Pollutant } from "@/lib/emission";
import { useClassCounts, useLiveCameras, useNow } from "@/lib/hooks";
import { mapThemeClass, useMapTheme } from "@/lib/map-theme";
import { roadRows, trafficSituation } from "@/lib/traffic";
import type { CameraOverview } from "@/lib/types";
import { ActivityPanels } from "./ActivityPanels";
import { EmissionPanels } from "./EmissionPanels";
import { RoadPanels } from "./RoadPanels";
import type { Layer, RoadPaint, Scope } from "./TrafficMap";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const TrafficMap = dynamic(() => import("./TrafficMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-none" />,
});

const LAYERS: { id: Layer; label: string }[] = [
  { id: "roads", label: "Ruas jalan" },
  { id: "activity", label: "Aktivitas per jam" },
  { id: "emission", label: "Beban emisi" },
];
const SCOPES: { id: Scope; label: string }[] = [
  { id: "center", label: "Pusat kota" },
  { id: "city", label: "Seluruh kota" },
];
const DEFAULT_HOUR = 12; // hanya dipakai sebelum jam browser diketahui

type Props = {
  initialCameras: CameraOverview[];
  /** Profil aktivitas per jam dari worker; `null` bila belum pernah dihitung atau gagal dimuat. */
  profile: ActivityProfile | null;
};

/**
 * Halaman Lalu Lintas: peta memenuhi layar dengan tiga lapisan. "Ruas jalan" menjawab seberapa padat tiap ruas
 * sekarang; "Aktivitas per jam" menjawab kawasan mana yang biasanya ramai pada jam tertentu; "Beban emisi"
 * menjawab ruas mana yang estimasi beban emisinya paling berat dibanding ruas lain.
 */
export function TrafficView({ initialCameras, profile }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const now = useNow(60_000);
  const [layer, setLayer] = useState<Layer>("roads");
  const [scope, setScope] = useState<{ kind: Scope; at: number }>({ kind: "center", at: 0 });

  const rows = useMemo(() => roadRows(cameras), [cameras]);
  const situation = useMemo(() => trafficSituation(rows), [rows]);
  const [selectedRoad, setSelectedRoad] = useState<string | null>(null);
  const latest = cameras.reduce<string | null>(
    (max, c) => (c.status_updated_at && (!max || c.status_updated_at > max) ? c.status_updated_at : max),
    null,
  );

  const [metric, setMetric] = useState<ActivityMetric>("vehicles");
  const [pickedHour, setPickedHour] = useState<number | null>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const currentHour = now === null ? null : hourWib(now);
  const hour = pickedHour ?? currentHour ?? DEFAULT_HOUR;
  const hexes = useMemo(() => (profile ? buildHexes(cameras, profile, metric) : []), [cameras, profile, metric]);
  const breaks = useMemo(() => activityBreaks(hexes), [hexes]);
  // Dipakai tombol Putar: maju satu jam dari jam yang sedang tampil, kembali ke 00 setelah 23.
  const advanceHour = useCallback(() => setPickedHour((picked) => ((picked ?? currentHour ?? DEFAULT_HOUR) + 1) % 24), [currentHour]);
  const activity = useMemo(
    () => ({ hexes, breaks, hour, selected: selectedHex, onSelect: setSelectedHex }),
    [hexes, breaks, hour, selectedHex],
  );

  const [pollutant, setPollutant] = useState<Pollutant>("co2");
  // Hitungan per jenis kendaraan hanya dimuat saat lapisan emisi dibuka.
  const counts = useClassCounts(layer === "emission");
  const emission = useMemo(() => (counts.rows ? emissionRows(rows, counts.rows, pollutant) : null), [rows, counts.rows, pollutant]);
  const emissionPaint: RoadPaint = useMemo(
    () => new Map((emission ?? []).map((item) => [item.row.camera.id, { level: item.level, label: EMISSION_LEVELS[item.level - 1] }])),
    [emission],
  );

  const mapTheme = useMapTheme();
  const group = "flex gap-1";
  const button = (active: boolean) =>
    `rounded-control px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${
      active ? "bg-primary font-semibold text-on-primary" : "font-medium text-muted hover:bg-surface-muted hover:text-text"
    }`;

  return (
    <div className="relative flex flex-1 flex-col lg:min-h-[40rem]">
      <section aria-label="Peta lalu lintas" className={`relative h-[60dvh] min-h-96 lg:absolute lg:inset-0 lg:h-auto ${mapThemeClass(mapTheme)}`}>
        <TrafficMap
          layer={layer}
          rows={rows}
          selected={selectedRoad}
          scope={scope}
          onSelect={setSelectedRoad}
          activity={activity}
          emission={emissionPaint}
        />

        <div className="map-panel absolute top-3 left-1/2 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-2 overflow-x-auto p-1">
          <div role="group" aria-label="Lapisan peta" className={group}>
            {LAYERS.map((item) => (
              <button key={item.id} type="button" aria-pressed={item.id === layer} onClick={() => setLayer(item.id)} className={button(item.id === layer)}>
                {item.label}
              </button>
            ))}
          </div>
          <span aria-hidden className="h-5 w-px bg-border" />
          <div role="group" aria-label="Cakupan peta" className={group}>
            {SCOPES.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSelectedRoad(null);
                  setSelectedHex(null);
                  setScope((current) => ({ kind: item.id, at: current.at + 1 }));
                }}
                className="rounded-control px-2.5 py-1.5 text-xs font-medium whitespace-nowrap text-muted transition-colors hover:bg-surface-muted hover:text-text"
              >
                {item.label}
              </button>
            ))}
          </div>
          <span aria-hidden className="h-5 w-px bg-border" />
          <MapThemeToggle />
        </div>
      </section>

      {layer === "roads" ? (
        <RoadPanels rows={rows} situation={situation} latest={latest} selected={selectedRoad} onSelect={setSelectedRoad} />
      ) : layer === "emission" ? (
        <EmissionPanels
          rows={emission}
          error={counts.error}
          pollutant={pollutant}
          selected={selectedRoad}
          onPollutant={setPollutant}
          onSelect={setSelectedRoad}
        />
      ) : (
        <ActivityPanels
          profile={profile}
          hexes={hexes}
          breaks={breaks}
          hour={hour}
          currentHour={currentHour}
          metric={metric}
          selected={selectedHex}
          onHour={setPickedHour}
          onAdvance={advanceHour}
          onMetric={setMetric}
          onSelect={setSelectedHex}
        />
      )}
    </div>
  );
}
