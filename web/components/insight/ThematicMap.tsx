"use client";

import { CircleMarker, MapContainer, Polygon, TileLayer, Tooltip } from "react-leaflet";
import { CITY_BOUNDS, districtOf } from "@/lib/geo/districts";
import { themeDisplay, type DistrictSummary, type Theme } from "@/lib/insight";
import { DENSITY, NOT_ASSESSED, WATER } from "@/lib/status";
import type { CameraOverview } from "@/lib/types";

type Props = {
  summaries: DistrictSummary[];
  theme: Theme;
  sources: CameraOverview[];
  selected: string | null;
  onSelect: (district: string) => void;
};

/** Peta tematik per kecamatan. Hanya dirender di browser (lihat InsightView). */
export default function ThematicMap({ summaries, theme, sources, selected, onSelect }: Props) {
  return (
    <MapContainer bounds={CITY_BOUNDS} scrollWheelZoom className="h-full w-full rounded-token">
      <TileLayer
        attribution='&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {summaries.map((summary) => {
        const { name, polygons } = summary.district;
        const display = themeDisplay(summary, theme);
        const isSelected = name === selected;
        return (
          <Polygon
            // Leaflet hanya membaca className saat bentuk dibuat, jadi poligon dibuat ulang saat warnanya berubah.
            key={`${name}-${display.tone}-${isSelected}`}
            positions={polygons}
            className={`district tone-${display.tone}${isSelected ? " is-selected" : ""}`}
            eventHandlers={{ click: () => onSelect(name) }}
          >
            <Tooltip sticky>
              {name} · {display.label}
            </Tooltip>
          </Polygon>
        );
      })}
      {sources.map((camera) => {
        const status =
          theme === "risk"
            ? camera.water_status
              ? WATER[camera.water_status]
              : NOT_ASSESSED
            : DENSITY[camera.density_level ?? "tidak_diketahui"];
        return (
          <CircleMarker
            key={`${camera.id}-${status.tone}`}
            center={[camera.lat, camera.lng]}
            radius={4}
            className={`camera-marker tone-${status.tone}`}
            eventHandlers={{
              click: () => {
                const district = districtOf(camera.lat, camera.lng);
                if (district) onSelect(district);
              },
            }}
          >
            <Tooltip>
              {camera.name} · {status.label}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
