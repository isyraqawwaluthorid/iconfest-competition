"use client";

import { useMemo } from "react";
import { CITY_BOUNDS } from "@/lib/geo/districts";
import { collection, point, toneColor, type Properties } from "@/lib/map-gl";
import { useMapTheme } from "@/lib/map-theme";
import { displayFor, type MapLayer } from "@/lib/status";
import type { CameraOverview } from "@/lib/types";
import GlMap, { type GlLayer } from "./GlMap";

type Props = {
  cameras: CameraOverview[];
  layer: MapLayer;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const LAYERS: GlLayer[] = [
  {
    id: "cameras",
    type: "circle",
    source: "cameras",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["get", "r"], 16, ["*", ["get", "r"], 1.9]],
      "circle-stroke-color": ["get", "stroke"],
      "circle-stroke-width": ["get", "strokeWidth"],
    },
  },
];

/** Peta semua kamera sumber data versi 3D. Isinya sama dengan `CityMap` (versi datar). */
export default function CityMap3D({ cameras, layer, selectedId, onSelect }: Props) {
  const mapTheme = useMapTheme();
  const dark = mapTheme === "dark";
  const sources = useMemo(
    () => ({
      cameras: collection(
        // Kamera terpilih digambar terakhir supaya berada di atas.
        [...cameras]
          .sort((a, b) => Number(a.id === selectedId) - Number(b.id === selectedId))
          .map((camera) => {
            const status = displayFor(camera, layer);
            const selected = camera.id === selectedId;
            return point([camera.lat, camera.lng], {
              id: camera.id,
              color: toneColor(status.tone),
              r: selected ? 8 : 5.5,
              stroke: selected ? (dark ? "#ffffff" : "#18181b") : "#ffffff",
              strokeWidth: selected ? 3 : 1.5,
              tip: `${camera.name} · ${status.label}`,
            });
          }),
      ),
    }),
    [cameras, layer, selectedId, dark],
  );
  const handlers = useMemo(() => ({ cameras: (properties: Properties) => typeof properties.id === "string" && onSelect(properties.id) }), [onSelect]);

  return <GlMap theme={mapTheme} bounds={CITY_BOUNDS} pitch={40} sources={sources} layers={LAYERS} onFeatureClick={handlers} tipLayers={["cameras"]} navigation="top-right" />;
}
