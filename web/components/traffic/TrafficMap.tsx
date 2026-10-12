"use client";

import L from "leaflet";
import { useEffect, useMemo, useRef } from "react";
import { AttributionControl, CircleMarker, MapContainer, Pane, Polygon, Polyline, TileLayer, Tooltip, useMap, ZoomControl } from "react-leaflet";
import { activityLevel, hexTitle, type Hex } from "@/lib/activity";
import { CENTER_BOUNDS, ROADS_BOUNDS, segmentBounds } from "@/lib/geo/roads";
import { formatNumber } from "@/lib/insight";
import type { RoadRow } from "@/lib/traffic";

/** Yang digambar di peta: ruas jalan berwarna kepadatan, atau heksagon aktivitas pada jam yang dipilih. */
export type Layer = "roads" | "activity";

/** Cakupan peta: pusat kota (bingkai awal, cukup dekat untuk melihat bentuk jalan) atau semua ruas. */
export type Scope = "center" | "city";

/** Heksagon aktivitas beserta jam dan batas warna yang sedang dipakai. */
export type ActivityView = { hexes: Hex[]; breaks: number[]; hour: number; selected: string | null; onSelect: (hexId: string) => void };

type Props = {
  layer: Layer;
  rows: RoadRow[];
  selected: string | null;
  /** Cakupan yang terakhir diminta; `at` berganti tiap kali tombolnya ditekan, supaya menekan lagi tetap membingkai ulang. */
  scope: { kind: Scope; at: number };
  onSelect: (cameraId: string) => void;
  activity: ActivityView;
};

const SCOPE_BOUNDS = { center: CENTER_BOUNDS, city: ROADS_BOUNDS };

const WIDE_SCREEN = 1024;
const CLOSE_ZOOM = 17;
const HEX_ZOOM = 15;

/** Ruang yang disisakan untuk panel yang mengambang di atas peta pada layar lebar (lihat ThematicMap). */
function framing(): L.FitBoundsOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= WIDE_SCREEN;
  return wide ? { paddingTopLeft: [400, 76], paddingBottomRight: [420, 56] } : { padding: [16, 16] };
}

/**
 * Mendekat ke ruas yang dipilih, dan membingkai ulang saat cakupan diminta. Saat pilihan dilepas peta
 * tidak bergeser: orang yang sedang melihat satu kawasan tidak dilempar kembali ke seluruh kota.
 */
function Focus({ rows, selected, scope, activity }: Pick<Props, "rows" | "selected" | "scope" | "activity">) {
  const map = useMap();
  const segment = rows.find((row) => row.camera.id === selected)?.segment ?? null;
  useEffect(() => {
    if (segment) map.flyToBounds(segmentBounds(segment), { ...framing(), maxZoom: CLOSE_ZOOM, duration: 0.7 });
    // Hanya saat pilihan berganti; pembaruan data tidak boleh menggeser peta yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, selected]);
  const hex = activity.hexes.find((item) => item.id === activity.selected) ?? null;
  useEffect(() => {
    if (hex) map.flyToBounds(L.latLngBounds(hex.ring), { ...framing(), maxZoom: HEX_ZOOM, duration: 0.7 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, activity.selected]);
  const requested = useRef(scope.at);
  useEffect(() => {
    if (requested.current === scope.at) return; // bingkai awal sudah diatur MapContainer
    requested.current = scope.at;
    map.flyToBounds(SCOPE_BOUNDS[scope.kind], { ...framing(), duration: 0.7 });
  }, [map, scope]);
  return null;
}

/** Peta halaman Lalu Lintas: ruas jalan per kamera, atau heksagon aktivitas. Hanya dirender di browser (lihat TrafficView). */
export default function TrafficMap({ layer, rows, selected, scope, onSelect, activity }: Props) {
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
      <Focus rows={rows} selected={selected} scope={scope} activity={activity} />
      {layer === "activity" ? <ActivityHexes {...activity} /> : <Roads rows={ordered} selected={selected} onSelect={onSelect} />}
    </MapContainer>
  );
}

function Roads({ rows: ordered, selected, onSelect }: Pick<Props, "rows" | "selected" | "onSelect">) {
  return (
    <>
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
    </>
  );
}

/** Heksagon aktivitas: makin gelap makin ramai pada jam yang dipilih. Titik kecil menandai kamera sumbernya. */
function ActivityHexes({ hexes, breaks, hour, selected, onSelect }: ActivityView) {
  return (
    <>
      <Pane name="activity-hexes" style={{ zIndex: 410 }}>
        {hexes.map((hex) => {
          const value = hex.hourly[hour];
          const level = activityLevel(value, breaks);
          const isSelected = hex.id === selected;
          return (
            <Polygon
              // Leaflet hanya membaca className saat bentuk dibuat, jadi heksagon dibuat ulang saat tingkatnya berubah.
              key={`${hex.id}-${level}-${isSelected}`}
              positions={hex.ring}
              className={`activity-hex level-${level}${isSelected ? " is-selected" : ""}`}
              eventHandlers={{ click: () => onSelect(hex.id) }}
            >
              <Tooltip sticky>
                {hexTitle(hex)} · {value === null ? "belum ada data pada jam ini" : `rata-rata ${formatNumber(value, 1)} per gambar`}
              </Tooltip>
            </Polygon>
          );
        })}
      </Pane>
      <Pane name="activity-cameras" style={{ zIndex: 450 }}>
        {hexes.flatMap((hex) =>
          hex.cameras.map((camera) => (
            <CircleMarker key={camera.id} center={[camera.lat, camera.lng]} radius={2.5} className="activity-source" interactive={false} />
          )),
        )}
      </Pane>
    </>
  );
}
