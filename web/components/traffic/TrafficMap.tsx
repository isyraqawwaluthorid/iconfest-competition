"use client";

import L from "leaflet";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  AttributionControl,
  CircleMarker,
  MapContainer,
  Marker,
  Pane,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from "react-leaflet";
import { activityLevel, hexTitle, type Hex } from "@/lib/activity";
import type { LatLng } from "@/lib/geo/districts";
import { paintNetwork } from "@/lib/geo/road-network";
import { CENTER_BOUNDS, ROADS_BOUNDS, segmentBounds } from "@/lib/geo/roads";
import { formatNumber } from "@/lib/insight";
import { BASEMAP } from "@/lib/map-tiles";
import { groupPins, type RoadRow } from "@/lib/traffic";

/** Yang digambar di peta: ruas berwarna kepadatan, heksagon aktivitas pada jam yang dipilih, atau ruas berwarna beban emisi. */
export type Layer = "roads" | "activity" | "emission";

/** Warna ruas pengganti warna kepadatan: tingkat beban emisi (1 sampai 5) dan labelnya, per id kamera. */
export type RoadPaint = Map<string, { level: number; label: string }>;

/** Cakupan peta: pusat kota (bingkai awal, cukup dekat untuk melihat bentuk jalan) atau semua ruas. */
export type Scope = "center" | "city";

/** Heksagon aktivitas beserta jam dan batas warna yang sedang dipakai. */
export type ActivityView = {
  hexes: Hex[];
  /** Heksagon di dalam kota yang tidak punya kamera; digambar abu-abu supaya kisinya memenuhi kota. */
  empty: LatLng[][];
  breaks: number[];
  hour: number;
  selected: string | null;
  onSelect: (hexId: string) => void;
};

type Props = {
  layer: Layer;
  rows: RoadRow[];
  selected: string | null;
  /** Cakupan yang terakhir diminta; `at` berganti tiap kali tombolnya ditekan, supaya menekan lagi tetap membingkai ulang. */
  scope: { kind: Scope; at: number };
  onSelect: (cameraId: string) => void;
  activity: ActivityView;
  /** Tingkat beban emisi tiap ruas, dipakai lapisan "emission"; ruas yang tidak ada di sini digambar abu-abu. */
  emission: RoadPaint;
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
export default function TrafficMap({ layer, rows, selected, scope, onSelect, activity, emission }: Props) {
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
      <TileLayer {...BASEMAP} />
      <AttributionControl position="bottomleft" />
      <ZoomControl position="bottomleft" />
      <Focus rows={rows} selected={selected} scope={scope} activity={activity} />
      {layer === "activity" ? (
        <ActivityHexes {...activity} />
      ) : (
        <Roads rows={ordered} selected={selected} onSelect={onSelect} paint={layer === "emission" ? emission : null} />
      )}
    </MapContainer>
  );
}

type RoadsProps = Pick<Props, "rows" | "selected" | "onSelect"> & { paint: RoadPaint | null };

const BASE_ZOOM = 13; // di bawah ini pin dan garis memakai ukuran terkecilnya

/** Zoom peta saat ini; berubah setelah peta selesai didekatkan atau dijauhkan. */
function useZoom(): number {
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({ zoomend: () => setZoom(map.getZoom()) });
  return zoom;
}

const countIcons = new Map<number, L.DivIcon>();

/** Angka di tengah pin gabungan: jumlah kamera yang berdiri di tempat itu. */
function countIcon(count: number): L.DivIcon {
  const icon = countIcons.get(count) ?? L.divIcon({ className: "pin-count", html: `<span>${count}</span>`, iconSize: [0, 0] });
  countIcons.set(count, icon);
  return icon;
}

function Roads({ rows: ordered, selected, onSelect, paint }: RoadsProps) {
  // Tanpa `paint` ruas berwarna tingkat kepadatan; dengan `paint` berwarna tingkat beban emisi (abu-abu bila tidak ada).
  const look = ({ camera, status }: RoadRow) => {
    if (!paint) return { line: `tone-${status.tone}`, dot: `tone-${status.tone}`, label: status.label };
    const painted = paint.get(camera.id);
    return painted
      ? { line: `emission-${painted.level}`, dot: `emission-${painted.level}`, label: `beban ${painted.label.toLowerCase()}` }
      : { line: "tone-unknown", dot: "tone-unknown", label: "tidak ada gambar" };
  };
  // Makin dekat, pin dan garis makin besar, supaya pada skala jalan keduanya tetap menonjol di atas peta.
  const zoom = useZoom();
  const pinRadius = Math.min(18, Math.max(6, 6 + (zoom - 12) * 2.5));
  const thickness = Math.min(1.4, Math.max(1, 1 + (zoom - BASE_ZOOM) * 0.15));
  // Kamera yang berdiri di tempat yang sama menjadi satu pin berangka; yang paling padat (digambar terakhir) di depan.
  const pins = useMemo(() => groupPins([...ordered].reverse()).reverse(), [ordered]);
  // Jalan tanpa kamera mewarisi warna kamera terdekat yang sedang punya nilai, sebagai perkiraan.
  const network = useMemo(() => {
    const donors = ordered.filter((row) => (paint ? paint.has(row.camera.id) : row.measured));
    const lineOf = (row: RoadRow) => (paint ? `emission-${paint.get(row.camera.id)?.level}` : `tone-${row.status.tone}`);
    return paintNetwork(new Map(donors.map((row) => [row.camera.id, lineOf(row)])), "tone-unknown");
  }, [ordered, paint]);
  return (
    <>
      {/* Seluruh jaringan jalan utama. Satu garis gabungan per warna, supaya ribuan garis tetap ringan digambar. */}
      <Pane name="road-network" style={{ zIndex: 402 }}>
        {network.map((group) => (
          <Polyline
            key={`${group.tone}-${group.far}`}
            positions={group.lines}
            pathOptions={{ weight: 3 * thickness }}
            className={`road-segment is-network ${group.tone}${group.far ? " is-far" : ""}`}
          >
            <Tooltip sticky>
              {group.tone === "tone-unknown" ? "Tidak ada kamera berdata di dekat jalan ini" : "Perkiraan dari kamera terdekat, bukan pengamatan jalan ini"}
            </Tooltip>
          </Polyline>
        ))}
      </Pane>
      {/* Jalan yang sama lebih jauh dari kamera: warna kamera itu sebagai perkiraan, lebih tipis daripada ruas yang terlihat. */}
      <Pane name="road-extended" style={{ zIndex: 406 }}>
        {ordered.map((row) => {
          const { camera, segment, title } = row;
          const { line: tone, label } = look(row);
          return segment.extended.map((line, index) => (
            <Polyline
              // Leaflet hanya membaca className saat garis dibuat, jadi garis dibuat ulang saat warnanya berubah.
              key={`${camera.id}-${index}-${tone}`}
              positions={line}
              pathOptions={{ weight: 4 * thickness }}
              className={`road-segment is-extended ${tone}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            >
              <Tooltip sticky>
                {title} · {label} (perkiraan dari kamera {camera.name})
              </Tooltip>
            </Polyline>
          ));
        })}
      </Pane>
      {/* Tepi putih ruas yang terlihat kamera, di bawah warnanya, supaya menonjol dari perpanjangannya. */}
      <Pane name="road-casings" style={{ zIndex: 410 }}>
        {ordered.map(({ camera, segment }) =>
          segment.lines.map((line, index) => (
            <Polyline
              key={`${camera.id}-${index}-${camera.id === selected}`}
              positions={line}
              pathOptions={{ weight: (camera.id === selected ? 15 : 10) * thickness }}
              className={`road-casing${camera.id === selected ? " is-selected" : ""}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            />
          )),
        )}
      </Pane>
      <Pane name="road-segments" style={{ zIndex: 420 }}>
        {ordered.map((row) => {
          const { camera, segment, title } = row;
          const { line: tone, label } = look(row);
          return segment.lines.map((line, index) => (
            <Polyline
              key={`${camera.id}-${index}-${tone}-${camera.id === selected}`}
              positions={line}
              pathOptions={{ weight: (camera.id === selected ? 9 : 6) * thickness }}
              className={`road-segment ${tone}`}
              eventHandlers={{ click: () => onSelect(camera.id) }}
            >
              <Tooltip sticky>
                {title} · {label}
              </Tooltip>
            </Polyline>
          ));
        })}
      </Pane>
      {/* Titik kamera di atas garis: menunjukkan dari mana ruas itu dilihat. */}
      <Pane name="road-cameras" style={{ zIndex: 450 }}>
        {pins.map(({ center, members }) => {
          const active = members.find((row) => row.camera.id === selected);
          const shown = active ?? members[0];
          const { dot } = look(shown);
          // Pin gabungan: klik pertama memilih kamera terdepan, klik berikutnya berpindah ke kamera lain di tempat itu.
          const next = members[active ? (members.indexOf(active) + 1) % members.length : 0];
          return (
            // Lingkaran luar tembus pandang membuat pin terlihat dari jauh; yang bisa diklik adalah lingkaran dalamnya.
            <Fragment key={`${shown.camera.id}-${dot}-${Boolean(active)}-${members.length}`}>
              <CircleMarker center={center} radius={pinRadius + (active ? 9 : 6)} className={`camera-halo ${dot}`} interactive={false} />
              <CircleMarker
                center={center}
                radius={active ? pinRadius + 2 : pinRadius}
                className={`camera-marker ${dot}${active ? " is-selected" : ""}`}
                eventHandlers={{ click: () => onSelect(next.camera.id) }}
              >
                <Tooltip>
                  {members.length === 1
                    ? `Kamera ${shown.camera.name}`
                    : `${members.length} kamera di sini: ${members.map((row) => row.camera.name).join(", ")}. Klik lagi untuk berpindah kamera.`}
                </Tooltip>
              </CircleMarker>
              {members.length > 1 ? <Marker position={center} icon={countIcon(members.length)} interactive={false} keyboard={false} /> : null}
            </Fragment>
          );
        })}
      </Pane>
    </>
  );
}

/** Heksagon aktivitas: makin gelap makin ramai pada jam yang dipilih. Titik kecil menandai kamera sumbernya. */
function ActivityHexes({ hexes, empty, breaks, hour, selected, onSelect }: ActivityView) {
  // Satu bentuk gabungan untuk semua heksagon kosong, supaya ratusan heksagon tetap ringan digambar.
  const emptyShape = useMemo(() => empty.map((ring) => [ring]), [empty]);
  return (
    <>
      <Pane name="activity-empty" style={{ zIndex: 405 }}>
        {emptyShape.length > 0 ? <Polygon positions={emptyShape} className="activity-hex level-none" interactive={false} /> : null}
      </Pane>
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
