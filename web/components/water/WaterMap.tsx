"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useState } from "react";
import { AttributionControl, CircleMarker, MapContainer, Pane, TileLayer, Tooltip, useMap, useMapEvents, ZoomControl } from "react-leaflet";
import type { LatLng } from "@/lib/geo/districts";
import { BASEMAP } from "@/lib/map-tiles";
import { WATER } from "@/lib/status";
import type { WaterRow } from "@/lib/water";

type Props = {
  rows: WaterRow[];
  selected: string | null;
  onSelect: (cameraId: string) => void;
};

const WIDE_SCREEN = 1024;
const CLOSE_ZOOM = 16;

/** Ruang yang disisakan untuk panel yang mengambang di atas peta pada layar lebar (lihat ThematicMap). */
function framing(): L.FitBoundsOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= WIDE_SCREEN;
  return wide ? { paddingTopLeft: [400, 76], paddingBottomRight: [420, 56] } : { padding: [24, 24] };
}

/** Mendekat ke lokasi yang dipilih; saat pilihan dilepas peta tidak bergeser. */
function Focus({ rows, selected }: Pick<Props, "rows" | "selected">) {
  const map = useMap();
  const site = rows.find((row) => row.camera.id === selected)?.camera ?? null;
  useEffect(() => {
    if (site) map.flyToBounds(L.latLng(site.lat, site.lng).toBounds(600), { ...framing(), maxZoom: CLOSE_ZOOM, duration: 0.7 });
    // Hanya saat pilihan berganti; pembaruan data tidak boleh menggeser peta yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selected]);
  return null;
}

function Pins({ rows, selected, onSelect }: Props) {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  // Makin dekat, pin makin besar, sama seperti di peta lalu lintas.
  const radius = Math.min(18, Math.max(7, 7 + (zoom - 12) * 2.5));
  // Yang digambar belakangan berada di atas: lokasi normal dulu, yang naik atau menunggu konfirmasi terakhir.
  const ordered = useMemo(() => [...rows].reverse(), [rows]);
  return (
    <Pane name="water-sites" style={{ zIndex: 450 }}>
      {ordered.map(({ camera, status, pending }, index) => {
        const active = camera.id === selected;
        const tone = pending ? WATER[pending].tone : status.tone;
        const raised = status.tone === "waspada" || status.tone === "siaga" || status.tone === "awas";
        return (
          <Fragment key={`${camera.id}-${tone}-${pending ? "pending" : "plain"}-${active}`}>
            <CircleMarker center={[camera.lat, camera.lng]} radius={radius + (active ? 9 : 6)} className={`camera-halo tone-${tone}`} interactive={false} />
            <CircleMarker
              center={[camera.lat, camera.lng]}
              radius={active ? radius + 2 : radius}
              className={`camera-marker tone-${tone}${pending ? " is-pending" : active ? " is-selected" : raised ? " is-raised" : ""}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            >
              {/* Lokasi yang bergerak diberi label tetap, supaya terlihat tanpa harus diarahkan kursor. */}
              {pending || raised ? (
                <Tooltip permanent direction={index % 2 ? "bottom" : "top"} offset={[0, index % 2 ? radius : -radius]} className="site-label">
                  <strong>{camera.name}</strong>
                  <br />
                  {pending ? `Resmi: ${status.label.toLowerCase()} · indikasi ${WATER[pending].label.toLowerCase()}` : status.label}
                </Tooltip>
              ) : (
                <Tooltip>
                  {camera.name} · {status.label}
                </Tooltip>
              )}
            </CircleMarker>
          </Fragment>
        );
      })}
    </Pane>
  );
}

/** Peta halaman Air: satu pin per lokasi air yang dikalibrasi, berwarna status resminya. Hanya dirender di browser. */
export default function WaterMap({ rows, selected, onSelect }: Props) {
  const initialFraming = useMemo(() => framing(), []);
  const bounds = useMemo<[LatLng, LatLng]>(() => {
    const lats = rows.map((row) => row.camera.lat);
    const lngs = rows.map((row) => row.camera.lng);
    return [
      [Math.min(...lats), Math.min(...lngs)],
      [Math.max(...lats), Math.max(...lngs)],
    ];
    // Bingkai awal dihitung sekali; pembaruan status tidak mengubah letak lokasi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <MapContainer
      bounds={bounds}
      boundsOptions={initialFraming}
      zoomSnap={0.25}
      maxZoom={18}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      className="road-map h-full w-full"
    >
      <TileLayer {...BASEMAP} />
      <AttributionControl position="bottomleft" />
      <ZoomControl position="bottomleft" />
      <Focus rows={rows} selected={selected} />
      <Pins rows={rows} selected={selected} onSelect={onSelect} />
    </MapContainer>
  );
}
