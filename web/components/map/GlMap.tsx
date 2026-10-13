"use client";

import maplibregl, { type GeoJSONSource, type LayerSpecification, type Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useEffect, useRef } from "react";
import type { LatLng } from "@/lib/geo/districts";
import type { Collection, Properties } from "@/lib/map-gl";
import type { MapTheme } from "@/lib/map-theme";

/**
 * Mesin peta 3D bersama: peta vektor OpenFreeMap (data OpenStreetMap, tanpa kunci API) digambar MapLibre GL,
 * dengan sudut pandang miring dan bangunan timbul. Tiap halaman hanya menyerahkan datanya (`sources`, GeoJSON)
 * dan cara menggambarnya (`layers`); warna dan ukuran dibawa oleh properti tiap fitur, jadi pembaruan data
 * cukup mengganti isi sumber tanpa membuat ulang peta. Hanya dirender di browser.
 */
export type GlLayer = LayerSpecification & {
  /** "buildings": digambar di bawah bangunan (jalan, wilayah). Tanpa ini lapisan berada paling atas (pin, label). */
  under?: "buildings";
};

export type GlFocus = { key: string | number; bounds: [LatLng, LatLng]; maxZoom?: number };

type Props = {
  theme: MapTheme;
  /** Bingkai awal. */
  bounds: [LatLng, LatLng];
  /** Sisakan ruang untuk panel yang mengambang di kiri dan kanan pada layar lebar. */
  panels?: boolean;
  pitch?: number;
  bearing?: number;
  sources: Record<string, Collection>;
  layers: GlLayer[];
  /** Berganti bila susunan `layers` berganti (misalnya pindah lapisan); lapisan lama dilepas dan yang baru dipasang. */
  layersKey?: string;
  /** Lapisan yang bisa diklik → penerima properti fitur yang diklik. */
  onFeatureClick?: Record<string, (properties: Properties) => void>;
  /** Lapisan yang fiturnya membawa properti `tip`, ditampilkan saat kursor di atasnya. */
  tipLayers?: string[];
  /** Saat `key` berganti, peta terbang ke `bounds`. */
  focus?: GlFocus | null;
  navigation?: "bottom-left" | "top-right";
};

const STYLE_URL: Record<MapTheme, string> = {
  light: "https://tiles.openfreemap.org/styles/liberty",
  dark: "https://tiles.openfreemap.org/styles/dark",
};
const BUILDINGS = "bangunan-3d";
const WIDE_SCREEN = 1024;
export const LABEL_FONT = ["Noto Sans Bold"];

function padding(panels: boolean): maplibregl.PaddingOptions {
  const wide = typeof window !== "undefined" && window.innerWidth >= WIDE_SCREEN;
  return panels && wide ? { left: 400, right: 420, top: 76, bottom: 56 } : { left: 24, right: 24, top: 24, bottom: 24 };
}

const toBounds = ([[south, west], [north, east]]: [LatLng, LatLng]): [[number, number], [number, number]] => [
  [west, south],
  [east, north],
];

/** Pastikan ada bangunan 3D dan kembalikan id lapisannya. Gaya terang sudah punya; gaya gelap belum. */
function ensureBuildings(map: MapLibreMap, theme: MapTheme): string {
  const layers = map.getStyle().layers;
  const existing = layers.find((layer) => layer.type === "fill-extrusion")?.id;
  if (existing) return existing;
  // Tepat di atas lapisan gambar terakhir (jalan, rel, batas) dan di bawah tulisan yang mengikutinya. Tidak cukup
  // "di bawah tulisan pertama": pada gaya gelap tulisan pertama adalah nama perairan, jauh di bawah jalan.
  const lastDrawn = layers.reduce((last, layer, index) => (layer.type === "symbol" ? last : index), -1);
  map.addLayer(
    {
      id: BUILDINGS,
      type: "fill-extrusion",
      source: "openmaptiles",
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": theme === "dark" ? "#3a4050" : "#d9d4cc",
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 4],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": 0.85,
      },
    },
    layers[lastDrawn + 1]?.id,
  );
  return BUILDINGS;
}

export default function GlMap({
  theme,
  bounds,
  panels = false,
  pitch = 50,
  bearing = 0,
  sources,
  layers,
  layersKey = "",
  onFeatureClick,
  tipLayers,
  focus,
  navigation = "bottom-left",
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const ready = useRef(false);
  const mounted = useRef<string[]>([]); // id lapisan milik halaman yang sedang terpasang
  const latest = useRef({ sources, layers, onFeatureClick, tipLayers, focus });
  const focused = useRef<string | number | undefined>(focus?.key);

  function sync(map: MapLibreMap, replaceLayers: boolean) {
    const current = latest.current;
    for (const [name, data] of Object.entries(current.sources)) {
      const source = map.getSource(name) as GeoJSONSource | undefined;
      if (source) source.setData(data);
      else map.addSource(name, { type: "geojson", data });
    }
    if (!replaceLayers) return;
    for (const id of mounted.current) if (map.getLayer(id)) map.removeLayer(id);
    const buildings = ensureBuildings(map, theme);
    for (const { under, ...layer } of current.layers) map.addLayer(layer as LayerSpecification, under === "buildings" ? buildings : undefined);
    mounted.current = current.layers.map((layer) => layer.id);
  }

  useEffect(() => {
    latest.current = { sources, layers, onFeatureClick, tipLayers, focus };
  });

  // Peta dibuat ulang hanya saat tampilan terang/gelap berganti.
  useEffect(() => {
    if (!container.current) return;
    // Peta yang dibuat ulang (ganti terang/gelap) langsung kembali ke yang sedang dipilih, bukan ke bingkai awal.
    const start = latest.current.focus;
    const map = new maplibregl.Map({
      container: container.current,
      style: STYLE_URL[theme],
      bounds: toBounds(start?.bounds ?? bounds),
      fitBoundsOptions: { padding: padding(panels), maxZoom: start?.maxZoom ?? 17, bearing },
      pitch,
      bearing,
      maxPitch: 70,
      attributionControl: { compact: true },
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), navigation);
    const tip = new maplibregl.Popup({ closeButton: false, closeOnClick: false, className: "gl-tip", offset: 12 });
    map.on("load", () => {
      ready.current = true;
      sync(map, true);
    });
    // Satu pendengar untuk semua lapisan: lapisan boleh berganti tanpa mendaftar ulang.
    map.on("click", (event) => {
      const handlers = latest.current.onFeatureClick ?? {};
      const ids = Object.keys(handlers).filter((id) => map.getLayer(id));
      if (ids.length === 0) return;
      const feature = map.queryRenderedFeatures(event.point, { layers: ids })[0];
      if (feature) handlers[feature.layer.id]?.(feature.properties as Properties);
    });
    map.on("mousemove", (event) => {
      const clickable = Object.keys(latest.current.onFeatureClick ?? {});
      const ids = [...new Set([...clickable, ...(latest.current.tipLayers ?? [])])].filter((id) => map.getLayer(id));
      const feature = ids.length > 0 ? map.queryRenderedFeatures(event.point, { layers: ids })[0] : undefined;
      map.getCanvas().style.cursor = feature && clickable.includes(feature.layer.id) ? "pointer" : "";
      const text = feature?.properties?.tip;
      if (typeof text === "string" && text) tip.setLngLat(event.lngLat).setText(text).addTo(map);
      else tip.remove();
    });
    map.on("mouseout", () => tip.remove());
    return () => {
      ready.current = false;
      mounted.current = [];
      mapRef.current = null;
      map.remove();
    };
    // Bingkai awal, sudut pandang, dan letak kontrol hanya dibaca saat peta dibuat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  useEffect(() => {
    if (mapRef.current && ready.current) sync(mapRef.current, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sources]);

  useEffect(() => {
    if (mapRef.current && ready.current) sync(mapRef.current, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layersKey]);

  useEffect(() => {
    if (!focus) {
      focused.current = undefined; // pilihan dilepas: memilih yang sama lagi harus terbang lagi
      return;
    }
    if (focused.current === focus.key) return;
    focused.current = focus.key;
    const map = mapRef.current;
    // Arah yang sedang dipakai pengguna dipertahankan; tanpa ini peta selalu kembali menghadap utara.
    map?.fitBounds(toBounds(focus.bounds), { padding: padding(panels), maxZoom: focus.maxZoom ?? 17, bearing: map.getBearing(), duration: 800 });
  }, [focus, panels]);

  return <div ref={container} className="h-full w-full" />;
}
