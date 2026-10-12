"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { CameraPanel } from "@/components/camera/CameraPanel";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLiveCameras } from "@/lib/hooks";
import { mapThemeClass, useMapTheme } from "@/lib/map-theme";
import { isOnline, MAP_LAYERS, type MapLayer } from "@/lib/status";
import type { CameraOverview } from "@/lib/types";
import { Legend } from "./Legend";
import { MapThemeToggle } from "./MapThemeToggle";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const CityMap = dynamic(() => import("./CityMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

export function MapView({ initialCameras }: { initialCameras: CameraOverview[] }) {
  const cameras = useLiveCameras(initialCameras);
  const [layer, setLayer] = useState<MapLayer>("health");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const mapTheme = useMapTheme();

  const requiredModule = MAP_LAYERS.find((l) => l.id === layer)?.module ?? null;
  const visible = requiredModule ? cameras.filter((c) => c.modules.includes(requiredModule)) : cameras;
  const selected = visible.find((c) => c.id === selectedId) ?? null;
  const online = visible.filter(isOnline).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Lapisan peta">
        {MAP_LAYERS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            active={item.id === layer}
            aria-pressed={item.id === layer}
            onClick={() => setLayer(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <p className="text-sm text-muted">
          {visible.length} kamera, {online} aktif
        </p>
        <span className="ml-auto rounded-control border border-border bg-surface p-0.5">
          <MapThemeToggle />
        </span>
      </div>
      <Legend layer={layer} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className={`h-[60vh] min-h-80 lg:h-[72vh] ${mapThemeClass(mapTheme)}`}>
          <CityMap cameras={visible} layer={layer} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <aside className="rounded-token border border-border bg-surface p-4">
          {selected ? (
            <CameraPanel camera={selected} />
          ) : (
            <EmptyState
              title="Belum ada kamera dipilih"
              reason="Ketuk salah satu penanda di peta untuk melihat gambar dan kondisi terakhirnya."
            />
          )}
        </aside>
      </div>
    </div>
  );
}
