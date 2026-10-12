"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Marker,
  Polygon,
  TileLayer,
  Tooltip,
  useMap,
  ZoomControl,
} from "react-leaflet";
import { CITY_BOUNDS, districtOf, DISTRICTS, shortName } from "@/lib/geo/districts";
import { themeDisplay, type DistrictSummary, type Theme } from "@/lib/insight";
import { DENSITY, isElevated, NOT_ASSESSED, WATER } from "@/lib/status";
import type { CameraOverview, WaterStatus } from "@/lib/types";

type Props = {
  summaries: DistrictSummary[];
  theme: Theme;
  sources: CameraOverview[];
  /** Lokasi air yang baru sekali dinilai naik oleh AI dan belum dikonfirmasi: id kamera → level yang dinilai. */
  pending: Map<string, WaterStatus>;
  selected: string | null;
  onSelect: (district: string) => void;
};

const WIDE_SCREEN = 1024;

/**
 * Ruang yang disisakan untuk panel yang mengambang di atas peta pada layar lebar, agar wilayah
 * yang dibingkai tidak tertutup panel. Di layar sempit panel berada di bawah peta.
 */
function framing(): L.FitBoundsOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= WIDE_SCREEN;
  return wide ? { paddingTopLeft: [400, 76], paddingBottomRight: [420, 56] } : { padding: [8, 8] };
}

/** Menggeser peta ke kecamatan yang dipilih, atau kembali ke seluruh kota saat pilihan dilepas. */
function Focus({ selected }: { selected: string | null }) {
  const map = useMap();
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true; // bingkai awal sudah diatur MapContainer
      return;
    }
    const district = DISTRICTS.find((d) => d.name === selected);
    const bounds = district ? L.latLngBounds(district.polygons.flatMap((polygon) => polygon[0])) : L.latLngBounds(CITY_BOUNDS);
    map.flyToBounds(bounds, { ...framing(), maxZoom: 13.5, duration: 0.6 });
  }, [map, selected]);
  return null;
}

/** Peta tematik per kecamatan. Hanya dirender di browser (lihat InsightView). */
export default function ThematicMap({ summaries, theme, sources, pending, selected, onSelect }: Props) {
  const labels = useMemo(
    () =>
      DISTRICTS.map((district) => ({
        district,
        icon: L.divIcon({ className: "district-label", html: `<span>${shortName(district.name)}</span>`, iconSize: [0, 0] }),
      })),
    [],
  );
  const initialFraming = useMemo(() => framing(), []);
  // Yang digambar belakangan berada di atas: lokasi biasa dulu, lalu yang statusnya naik, lalu yang menunggu konfirmasi.
  const ordered = useMemo(() => {
    const weight = (camera: CameraOverview) => (theme !== "risk" ? 0 : pending.has(camera.id) ? 2 : isElevated(camera.water_status) ? 1 : 0);
    return [...sources].sort((a, b) => weight(a) - weight(b));
  }, [sources, pending, theme]);

  return (
    <MapContainer
      bounds={CITY_BOUNDS}
      boundsOptions={initialFraming}
      zoomSnap={0.25}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      className="thematic-map h-full w-full"
    >
      <TileLayer
        attribution='&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {/* Pojok kiri bawah adalah satu-satunya pojok yang tidak tertutup panel. */}
      <AttributionControl position="bottomleft" />
      <ZoomControl position="bottomleft" />
      <Focus selected={selected} />
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
      {labels.map(({ district, icon }) => (
        <Marker key={district.name} position={district.center} icon={icon} interactive={false} keyboard={false} />
      ))}
      {ordered.map((camera, index) => {
        const status =
          theme === "risk"
            ? camera.water_status
              ? WATER[camera.water_status]
              : NOT_ASSESSED
            : DENSITY[camera.density_level ?? "tidak_diketahui"];
        // Pada tema risiko air, lokasi yang bergerak dibuat menonjol: menunggu konfirmasi atau sudah naik.
        const waiting = theme === "risk" ? pending.get(camera.id) : undefined;
        const raised = theme === "risk" && isElevated(camera.water_status);
        const tone = waiting ? WATER[waiting].tone : status.tone;
        return (
          <CircleMarker
            key={`${camera.id}-${tone}-${waiting ? "pending" : raised ? "raised" : "plain"}`}
            center={[camera.lat, camera.lng]}
            radius={waiting ? 12 : raised ? 9 : 4}
            className={`camera-marker tone-${tone}${waiting ? " is-pending" : raised ? " is-raised" : ""}`}
            eventHandlers={{
              click: () => {
                const district = districtOf(camera.lat, camera.lng);
                if (district) onSelect(district);
              },
            }}
          >
            {/* Lokasi yang bergerak diberi label tetap, supaya terlihat tanpa harus diarahkan kursor. */}
            {waiting || raised ? (
              <Tooltip permanent direction={index % 2 ? "bottom" : "top"} offset={[0, index % 2 ? 12 : -12]} className="site-label">
                <strong>{camera.name}</strong>
                <br />
                {waiting ? `AI menilai ${WATER[waiting].label.toLowerCase()} · 1 dari 2` : status.label}
              </Tooltip>
            ) : (
              <Tooltip>
                {camera.name} · {status.label}
              </Tooltip>
            )}
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
