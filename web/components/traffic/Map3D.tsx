"use client";

import maplibregl, { type GeoJSONSource, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import { paintNetwork } from "@/lib/geo/road-network";
import type { LatLng } from "@/lib/geo/districts";
import type { MapTheme } from "@/lib/map-theme";
import type { RoadRow } from "@/lib/traffic";

/**
 * Percobaan peta 3D halaman Lalu lintas: peta vektor OpenFreeMap (data OpenStreetMap, tanpa kunci API) digambar
 * MapLibre GL dengan sudut pandang miring dan bangunan timbul. Isinya sama dengan lapisan "Ruas jalan" versi
 * datar: jalan berwarna tingkat kepadatan dan pin kamera. Tinggi bangunan berasal dari OpenStreetMap; bangunan
 * yang tidak punya data tinggi digambar rendah. Hanya dirender di browser.
 */
type Props = {
  rows: RoadRow[];
  theme: MapTheme;
  onSelect: (cameraId: string) => void;
};

const STYLE_URL: Record<MapTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const START = { center: [110.4203, -6.9858] as [number, number], zoom: 15.2, pitch: 58, bearing: -18 };
const BUILDINGS = "bangunan-3d";

/** Warna tiap tingkat diambil dari token CSS (globals.css), supaya peta 3D dan peta datar memakai warna yang sama. */
const TONE_VARIABLE: Record<string, string> = {
  "tone-density-lancar": "--density-lancar",
  "tone-density-normal": "--density-normal",
  "tone-density-ramai": "--density-ramai",
  "tone-density-padat": "--density-padat",
  "tone-offline": "--status-offline",
  "tone-unknown": "--road-untracked",
};

function toneColors(): Record<string, string> {
  const style = getComputedStyle(document.documentElement);
  return Object.fromEntries(Object.entries(TONE_VARIABLE).map(([tone, variable]) => [tone, style.getPropertyValue(variable).trim() || "#8a93a6"]));
}

const lngLat = (line: LatLng[]) => line.map(([lat, lng]) => [lng, lat]);

type Collection = GeoJSON.FeatureCollection<GeoJSON.Geometry, Record<string, string | number | boolean>>;

/** Jalan, ruas dekat kamera, dan pin kamera sebagai GeoJSON; warnanya sudah ditetapkan di sini. */
function collections(rows: RoadRow[]): { network: Collection; extended: Collection; segments: Collection; cameras: Collection } {
  const colors = toneColors();
  const toneOf = (row: RoadRow) => `tone-${row.status.tone}`;
  const donors = new Map(rows.filter((row) => row.measured).map((row) => [row.camera.id, toneOf(row)]));
  const lines = (line: LatLng[][], properties: Record<string, string | number | boolean>) => ({
    type: "Feature" as const,
    geometry: { type: "MultiLineString" as const, coordinates: line.map(lngLat) },
    properties,
  });
  return {
    network: {
      type: "FeatureCollection",
      // Jalan tanpa kamera: warna kamera terdekat yang sedang punya nilai, sebagai perkiraan; makin jauh makin pudar.
      features: paintNetwork(donors, "tone-unknown").map((group) => lines(group.lines, { color: colors[group.tone], opacity: group.far ? 0.45 : 0.8 })),
    },
    extended: { type: "FeatureCollection", features: rows.map((row) => lines(row.segment.extended, { color: colors[toneOf(row)], id: row.camera.id })) },
    segments: { type: "FeatureCollection", features: rows.map((row) => lines(row.segment.lines, { color: colors[toneOf(row)], id: row.camera.id })) },
    cameras: {
      type: "FeatureCollection",
      features: rows.map((row) => ({
        type: "Feature" as const,
        geometry: { type: "Point" as const, coordinates: [row.camera.lng, row.camera.lat] },
        properties: { color: colors[toneOf(row)], id: row.camera.id, name: row.camera.name, label: row.status.label },
      })),
    },
  };
}

function addLayers(map: MapLibreMap, theme: MapTheme, data: ReturnType<typeof collections>) {
  // Disisipkan tepat di atas lapisan gambar terakhir (jalan, rel, batas) dan di bawah tulisan yang mengikutinya.
  // Tidak cukup "di bawah tulisan pertama": pada gaya gelap tulisan pertama adalah nama perairan, jauh di bawah jalan.
  const styleLayers = map.getStyle().layers;
  const lastDrawn = styleLayers.reduce((last, layer, index) => (layer.type === "symbol" ? last : index), -1);
  const firstLabel = styleLayers[lastDrawn + 1]?.id;
  // Gaya terang sudah punya bangunan 3D; gaya gelap belum, jadi ditambahkan dari sumber yang sama.
  const existing = map.getStyle().layers.find((layer) => layer.type === "fill-extrusion")?.id;
  if (!existing) {
    map.addLayer(
      {
        id: BUILDINGS,
        type: "fill-extrusion",
        source: "openmaptiles",
        "source-layer": "building",
        minzoom: 13,
        paint: {
          "fill-extrusion-color": theme === "dark" ? "#3a4050" : "#d9d4cc",
          "fill-extrusion-height": ["coalesce", ["get", "render_height"], 4],
          "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
          "fill-extrusion-opacity": 0.85,
        },
      },
      firstLabel,
    );
  }
  const below = existing ?? BUILDINGS; // jalan digambar di bawah bangunan, supaya gedung menutupi jalan di belakangnya
  const width = (base: number): maplibregl.ExpressionSpecification => ["interpolate", ["linear"], ["zoom"], 11, base * 0.5, 15, base, 18, base * 2.2];
  map.addSource("network", { type: "geojson", data: data.network });
  map.addSource("extended", { type: "geojson", data: data.extended });
  map.addSource("segments", { type: "geojson", data: data.segments });
  map.addSource("cameras", { type: "geojson", data: data.cameras });
  const round = { "line-cap": "round" as const, "line-join": "round" as const };
  map.addLayer({ id: "network", type: "line", source: "network", layout: round, paint: { "line-color": ["get", "color"], "line-opacity": ["get", "opacity"], "line-width": width(3.5) } }, below);
  map.addLayer({ id: "extended", type: "line", source: "extended", layout: round, paint: { "line-color": ["get", "color"], "line-opacity": 0.9, "line-width": width(5) } }, below);
  map.addLayer({ id: "segments-casing", type: "line", source: "segments", layout: round, paint: { "line-color": "#ffffff", "line-width": width(11) } }, below);
  map.addLayer({ id: "segments", type: "line", source: "segments", layout: round, paint: { "line-color": ["get", "color"], "line-width": width(7) } }, below);
  map.addLayer({
    id: "cameras-halo",
    type: "circle",
    source: "cameras",
    paint: { "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 8, 16, 24], "circle-pitch-alignment": "map" },
  });
  map.addLayer({
    id: "cameras",
    type: "circle",
    source: "cameras",
    paint: {
      "circle-color": ["get", "color"],
      "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 4, 16, 11],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 2,
      "circle-pitch-alignment": "map",
    },
  });
}

export default function Map3D({ rows, theme, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const latest = useRef({ rows, onSelect });
  useEffect(() => {
    latest.current = { rows, onSelect };
  }, [rows, onSelect]);

  // Peta dibuat ulang hanya saat tampilan terang/gelap berganti; pembaruan data cukup mengganti isi sumbernya.
  useEffect(() => {
    if (!container.current) return;
    const map = new maplibregl.Map({ container: container.current, style: STYLE_URL[theme], ...START, maxPitch: 70, attributionControl: { compact: true } });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-left");
    map.on("load", () => {
      addLayers(map, theme, collections(latest.current.rows));
      map.on("click", "cameras", (event) => {
        const id = event.features?.[0]?.properties?.id;
        if (typeof id === "string") latest.current.onSelect(id);
      });
      map.on("mouseenter", "cameras", () => (map.getCanvas().style.cursor = "pointer"));
      map.on("mouseleave", "cameras", () => (map.getCanvas().style.cursor = ""));
    });
    return () => {
      mapRef.current = null;
      map.remove();
    };
  }, [theme]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.getSource("cameras")) return; // belum termuat: data awal dipasang saat "load"
    const data = collections(rows);
    (Object.keys(data) as (keyof typeof data)[]).forEach((name) => (map.getSource(name) as GeoJSONSource).setData(data[name]));
  }, [rows]);

  return <div ref={container} className="h-full w-full" />;
}
