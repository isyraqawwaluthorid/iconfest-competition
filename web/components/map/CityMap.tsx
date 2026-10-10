"use client";

import { CircleMarker, MapContainer, TileLayer, Tooltip } from "react-leaflet";
import { displayFor, type MapLayer } from "@/lib/status";
import type { CameraOverview } from "@/lib/types";

const SEMARANG_CENTER: [number, number] = [-6.99, 110.42];

type Props = {
  cameras: CameraOverview[];
  layer: MapLayer;
  selectedId: string | null;
  onSelect: (id: string) => void;
};

/** Peta Leaflet + OpenStreetMap. Hanya dirender di browser (lihat MapView). */
export default function CityMap({ cameras, layer, selectedId, onSelect }: Props) {
  return (
    <MapContainer center={SEMARANG_CENTER} zoom={12} scrollWheelZoom className="h-full w-full rounded-token">
      <TileLayer
        attribution='&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {cameras.map((camera) => {
        const status = displayFor(camera, layer);
        const selected = camera.id === selectedId;
        return (
          <CircleMarker
            // Leaflet hanya membaca className saat penanda dibuat, jadi penanda dibuat ulang saat statusnya berubah.
            key={`${camera.id}-${status.tone}-${selected}`}
            center={[camera.lat, camera.lng]}
            radius={selected ? 10 : 7}
            className={`camera-marker tone-${status.tone}${selected ? " is-selected" : ""}`}
            eventHandlers={{ click: () => onSelect(camera.id) }}
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
