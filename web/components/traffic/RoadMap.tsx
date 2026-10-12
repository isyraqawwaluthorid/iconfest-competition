"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { AttributionControl, CircleMarker, MapContainer, Pane, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { CENTER_BOUNDS, ROADS_BOUNDS, segmentBounds } from "@/lib/geo/roads";
import type { RoadRow } from "@/lib/traffic";

/** Cakupan peta: pusat kota (bingkai awal, cukup dekat untuk melihat bentuk jalan) atau semua ruas. */
export type Scope = "center" | "city";

type Props = {
  rows: RoadRow[];
  selected: string | null;
  /** Cakupan yang terakhir diminta; `at` berganti tiap kali tombolnya ditekan, supaya menekan lagi tetap membingkai ulang. */
  scope: { kind: Scope; at: number };
  onSelect: (cameraId: string) => void;
};

const SCOPE_BOUNDS = { center: CENTER_BOUNDS, city: ROADS_BOUNDS };

const WIDE_SCREEN = 1024;
const CLOSE_ZOOM = 17;

/** Ruang yang disisakan untuk panel yang mengambang di atas peta pada layar lebar (lihat ThematicMap). */
function framing(): L.FitBoundsOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= WIDE_SCREEN;
  return wide ? { paddingTopLeft: [400, 76], paddingBottomRight: [420, 56] } : { padding: [16, 16] };
}

/**
 * Mendekat ke ruas yang dipilih, dan membingkai ulang saat cakupan diminta. Saat pilihan dilepas peta
 * tidak bergeser: orang yang sedang melihat satu kawasan tidak dilempar kembali ke seluruh kota.
 */
function Focus({ rows, selected, scope }: Pick<Props, "rows" | "selected" | "scope">) {
  const map = useMap();
  const segment = rows.find((row) => row.camera.id === selected)?.segment ?? null;
  useEffect(() => {
    if (segment) map.flyToBounds(segmentBounds(segment), { ...framing(), maxZoom: CLOSE_ZOOM, duration: 0.7 });
    // Hanya saat pilihan berganti; pembaruan data tidak boleh menggeser peta yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selected]);
  const requested = useRef(scope.at);
  useEffect(() => {
    if (requested.current === scope.at) return; // bingkai awal sudah diatur MapContainer
    requested.current = scope.at;
    map.flyToBounds(SCOPE_BOUNDS[scope.kind], { ...framing(), duration: 0.7 });
  }, [map, scope]);
  return null;
}

/** Peta ruas jalan: satu ruas per kamera lalu lintas. Hanya dirender di browser (lihat TrafficView). */
export default function RoadMap({ rows, selected, scope, onSelect }: Props) {
  const initialFraming = useMemo(() => framing(), []);
  // Yang digambar belakangan berada di atas: ruas tanpa nilai dulu, yang paling padat terakhir, yang dipilih paling atas.
  const ordered = useMemo(
    () => [...rows].reverse().sort((a, b) => Number(a.camera.id === selected) - Number(b.camera.id === selected)),
    [rows, selected],
  );

  return (
    <MapContainer
      bounds={SCOPE_BOUNDS[scope.kind]}
      boundsOptions={initialFraming}
      zoomSnap={0.25}
      maxZoom={18}
      zoomControl={false}
      attributionControl={false}
      scrollWheelZoom
      className="road-map h-full w-full"
    >
      <TileLayer
        attribution='&copy; kontributor <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />
      <AttributionControl position="bottomleft" />
      <ZoomControl position="bottomleft" />
      <Focus rows={rows} selected={selected} scope={scope} />
      {/* Tepi putih semua ruas di lapisan bawah, supaya tepi satu ruas tidak menutupi warna ruas di sebelahnya. */}
      <Pane name="road-casings" style={{ zIndex: 410 }}>
        {ordered.map(({ camera, segment }) =>
          segment.lines.map((line, index) => (
            <Polyline
              // Leaflet hanya membaca className saat garis dibuat, jadi garis dibuat ulang saat pilihannya berubah.
              key={`${camera.id}-${index}-${camera.id === selected}`}
              positions={line}
              pathOptions={{ weight: camera.id === selected ? 16 : 11 }}
              className={`road-casing${camera.id === selected ? " is-selected" : ""}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            />
          )),
        )}
      </Pane>
      <Pane name="road-segments" style={{ zIndex: 420 }}>
        {ordered.map(({ camera, segment, title, status }) =>
          segment.lines.map((line, index) => (
            <Polyline
              key={`${camera.id}-${index}-${status.tone}-${camera.id === selected}`}
              positions={line}
              pathOptions={{ weight: camera.id === selected ? 9 : 6 }}
              className={`road-segment tone-${status.tone}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            >
              <Tooltip sticky>
                {title} · {status.label}
              </Tooltip>
            </Polyline>
          )),
        )}
      </Pane>
      {/* Titik kamera di atas garis: menunjukkan dari mana ruas itu dilihat. */}
      <Pane name="road-cameras" style={{ zIndex: 450 }}>
        {ordered.map(({ camera, status }) => (
          <CircleMarker
            key={`${camera.id}-${status.tone}-${camera.id === selected}`}
            center={[camera.lat, camera.lng]}
            radius={camera.id === selected ? 7 : 4}
            className={`camera-marker tone-${status.tone}${camera.id === selected ? " is-selected" : ""}`}
            eventHandlers={{ click: () => onSelect(camera.id) }}
          >
            <Tooltip>Kamera {camera.name}</Tooltip>
          </CircleMarker>
        ))}
      </Pane>
    </MapContainer>
  );
}
