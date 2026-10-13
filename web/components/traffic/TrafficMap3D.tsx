"use client";

import { useMemo } from "react";
import GlMap, { LABEL_FONT, type GlFocus, type GlLayer } from "@/components/map/GlMap";
import { activityLevel, hexTitle } from "@/lib/activity";
import { paintNetwork } from "@/lib/geo/road-network";
import { CENTER_BOUNDS, ROADS_BOUNDS, segmentBounds } from "@/lib/geo/roads";
import { formatNumber } from "@/lib/insight";
import { boundsOf, collection, multiLine, multiPolygon, point, toneColor, tokenColor, type Properties } from "@/lib/map-gl";
import { useMapTheme } from "@/lib/map-theme";
import { groupPins, type RoadRow } from "@/lib/traffic";
import type { ActivityView, Layer, RoadPaint, Scope } from "./TrafficMap";

type Props = {
  layer: Layer;
  rows: RoadRow[];
  selected: string | null;
  scope: { kind: Scope; at: number };
  onSelect: (cameraId: string) => void;
  activity: ActivityView;
  emission: RoadPaint;
};

const SCOPE_BOUNDS = { center: CENTER_BOUNDS, city: ROADS_BOUNDS };
const HEX_HEIGHT_M = 70; // tinggi tiap tingkat aktivitas; heksagon paling ramai setinggi lima tingkat
const widthAt = (base: number): GlLayer["paint"] => ({ "line-width": ["interpolate", ["linear"], ["zoom"], 11, base * 0.5, 15, base, 18, base * 2.2] });
const ROUND = { "line-cap": "round", "line-join": "round" } as const;

/** Peta halaman Lalu lintas versi 3D. Isi dan aturannya sama dengan `TrafficMap` (versi datar). */
export default function TrafficMap3D({ layer, rows, selected, scope, onSelect, activity, emission }: Props) {
  const mapTheme = useMapTheme();
  const dark = mapTheme === "dark";

  const roads = useMemo(() => {
    const grey = tokenColor("--road-untracked");
    const paint = layer === "emission" ? emission : null;
    // Tanpa `paint` ruas berwarna tingkat kepadatan; dengan `paint` berwarna tingkat beban emisi (abu-abu bila tidak ada).
    const look = (row: RoadRow) => {
      if (!paint) return { color: toneColor(row.status.tone), label: row.status.label };
      const painted = paint.get(row.camera.id);
      return painted ? { color: tokenColor(`--emission-${painted.level}`), label: `beban ${painted.label.toLowerCase()}` } : { color: grey, label: "tidak ada gambar" };
    };
    // Jalan tanpa kamera mewarisi warna kamera terdekat yang sedang punya nilai, sebagai perkiraan.
    const donors = new Map(rows.filter((row) => (paint ? paint.has(row.camera.id) : row.measured)).map((row) => [row.camera.id, look(row).color]));
    const network = paintNetwork(donors, grey).map((group) =>
      multiLine(group.lines, {
        color: group.tone,
        opacity: group.far ? 0.5 : 0.85,
        tip: group.tone === grey ? "Tidak ada kamera berdata di dekat jalan ini" : "Perkiraan dari kamera terdekat, bukan pengamatan jalan ini",
      }),
    );
    const ordered = [...rows].reverse().sort((a, b) => Number(a.camera.id === selected) - Number(b.camera.id === selected));
    const pins = groupPins([...ordered].reverse())
      .reverse()
      .map(({ center, members }) => {
        const active = members.find((row) => row.camera.id === selected);
        const shown = active ?? members[0];
        return point(center, {
          ids: members.map((row) => row.camera.id).join("|"),
          color: paint ? grey : toneColor(shown.status.tone),
          r: active ? 8.5 : 7,
          stroke: active ? (dark ? "#ffffff" : "#18181b") : "#ffffff",
          count: members.length > 1 ? String(members.length) : "",
          tip:
            members.length === 1
              ? `Kamera ${shown.camera.name}`
              : `${members.length} kamera di sini: ${members.map((row) => row.camera.name).join(", ")}. Klik lagi untuk berpindah kamera.`,
        });
      });
    const line = (row: RoadRow, lines: RoadRow["segment"]["lines"], estimate: boolean) => {
      const { color, label } = look(row);
      return multiLine(lines, {
        id: row.camera.id,
        color,
        selected: row.camera.id === selected,
        casing: row.camera.id === selected ? (dark ? "#ffffff" : "#18181b") : "#ffffff",
        tip: `${row.title} · ${label}${estimate ? ` (perkiraan dari kamera ${row.camera.name})` : ""}`,
      });
    };
    return {
      network: collection(network),
      extended: collection(ordered.map((row) => line(row, row.segment.extended, true))),
      segments: collection(ordered.map((row) => line(row, row.segment.lines, false))),
      pins: collection(pins),
    };
  }, [rows, selected, layer, emission, dark]);

  const hexes = useMemo(() => {
    const filled = activity.hexes.map((hex) => {
      const value = hex.hourly[activity.hour];
      const level = activityLevel(value, activity.breaks);
      const isSelected = hex.id === activity.selected;
      return multiPolygon([[hex.ring]], {
        id: hex.id,
        // Tingkat 0: jam ini belum punya data; digambar rata dan abu-abu, bukan dianggap sepi.
        color: level === 0 ? tokenColor("--status-unknown") : isSelected ? tokenColor("--primary") : tokenColor(`--activity-${level}`),
        height: level * HEX_HEIGHT_M,
        tip: `${hexTitle(hex)} · ${value === null ? "belum ada data pada jam ini" : `rata-rata ${formatNumber(value, 1)} per gambar`}`,
      });
    });
    return {
      "hex-empty": collection(activity.empty.length > 0 ? [multiPolygon(activity.empty.map((ring) => [ring]), {})] : []),
      hexes: collection(filled),
      "hex-cameras": collection(activity.hexes.flatMap((hex) => hex.cameras.map((camera) => point([camera.lat, camera.lng], {})))),
    };
  }, [activity.hexes, activity.empty, activity.breaks, activity.hour, activity.selected]);

  const sources = useMemo(() => ({ ...roads, ...hexes }), [roads, hexes]);

  const layers = useMemo<GlLayer[]>(() => {
    if (layer === "activity") {
      return [
        { id: "hex-empty", type: "fill", source: "hex-empty", under: "buildings", paint: { "fill-color": tokenColor("--status-unknown"), "fill-opacity": dark ? 0.2 : 0.3 } },
        { id: "hex-empty-lines", type: "line", source: "hex-empty", under: "buildings", paint: { "line-color": dark ? "#15171c" : "#ffffff", "line-width": 1.5, "line-opacity": 0.9 } },
        // Heksagon berkamera yang belum punya data pada jam ini: rata dan pucat, bukan dianggap sepi.
        { id: "hexes-flat", type: "fill", source: "hexes", under: "buildings", filter: ["==", ["get", "height"], 0], paint: { "fill-color": ["get", "color"], "fill-opacity": dark ? 0.3 : 0.4 } },
        // Tinggi heksagon mengikuti tingkat aktivitasnya pada jam yang dipilih: makin tinggi dan gelap, makin ramai.
        {
          id: "hexes",
          type: "fill-extrusion",
          source: "hexes",
          filter: [">", ["get", "height"], 0],
          paint: { "fill-extrusion-color": ["get", "color"], "fill-extrusion-height": ["get", "height"], "fill-extrusion-opacity": 0.82 },
        },
        { id: "hex-cameras", type: "circle", source: "hex-cameras", paint: { "circle-radius": 2.5, "circle-color": "#ffffff", "circle-stroke-color": "#18181b", "circle-stroke-width": 1 } },
      ];
    }
    return [
      { id: "network", type: "line", source: "network", under: "buildings", layout: ROUND, paint: { "line-color": ["get", "color"], "line-opacity": ["get", "opacity"], ...widthAt(3.5) } },
      { id: "extended", type: "line", source: "extended", under: "buildings", layout: ROUND, paint: { "line-color": ["get", "color"], "line-opacity": 0.9, ...widthAt(5) } },
      { id: "segments-casing", type: "line", source: "segments", under: "buildings", layout: ROUND, paint: { "line-color": ["get", "casing"], ...widthAt(11) } },
      { id: "segments", type: "line", source: "segments", under: "buildings", layout: ROUND, paint: { "line-color": ["get", "color"], ...widthAt(7) } },
      {
        id: "pins-halo",
        type: "circle",
        source: "pins",
        paint: { "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "r"], 1.1], 16, ["*", ["get", "r"], 3.2]], "circle-pitch-alignment": "map" },
      },
      {
        id: "pins",
        type: "circle",
        source: "pins",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "r"], 0.6], 16, ["*", ["get", "r"], 1.7]],
          "circle-stroke-color": ["get", "stroke"],
          "circle-stroke-width": 2,
          "circle-pitch-alignment": "map",
        },
      },
      // Angka pada pin gabungan: jumlah kamera yang berdiri di tempat itu.
      {
        id: "pin-counts",
        type: "symbol",
        source: "pins",
        filter: ["!=", ["get", "count"], ""],
        layout: { "text-field": ["get", "count"], "text-font": LABEL_FONT, "text-size": 11, "text-allow-overlap": true },
        paint: { "text-color": "#ffffff" },
      },
    ];
  }, [layer, dark]);

  const focus = useMemo<GlFocus | null>(() => {
    if (layer === "activity") {
      const hex = activity.hexes.find((item) => item.id === activity.selected);
      if (hex) return { key: `hex-${hex.id}`, bounds: boundsOf(hex.ring), maxZoom: 14.5 };
    } else {
      const segment = rows.find((row) => row.camera.id === selected)?.segment;
      if (segment) return { key: `ruas-${selected}`, bounds: segmentBounds(segment), maxZoom: 16.5 };
    }
    // Tanpa pilihan, peta hanya membingkai ulang saat tombol cakupan ditekan.
    return scope.at === 0 ? null : { key: `cakupan-${scope.at}`, bounds: SCOPE_BOUNDS[scope.kind] };
    // Hanya saat pilihan atau cakupan berganti; pembaruan data tidak boleh menggeser peta yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layer, selected, activity.selected, scope]);

  const handlers = useMemo(() => {
    const pick = (properties: Properties) => {
      // Pin gabungan: klik pertama memilih kamera terdepan, klik berikutnya berpindah ke kamera lain di tempat itu.
      const ids = String(properties.ids ?? properties.id ?? "").split("|").filter(Boolean);
      if (ids.length === 0) return;
      const at = selected ? ids.indexOf(selected) : -1;
      onSelect(ids[at >= 0 ? (at + 1) % ids.length : 0]);
    };
    const pickHex = (properties: Properties) => typeof properties.id === "string" && activity.onSelect(properties.id);
    return { pins: pick, segments: pick, extended: pick, hexes: pickHex, "hexes-flat": pickHex };
  }, [selected, onSelect, activity]);

  return (
    <GlMap
      theme={mapTheme}
      bounds={SCOPE_BOUNDS[scope.kind]}
      panels
      pitch={52}
      bearing={-15}
      sources={sources}
      layers={layers}
      layersKey={`${layer === "activity" ? "aktivitas" : "jalan"}-${dark}`}
      onFeatureClick={handlers}
      tipLayers={["network", "extended", "segments", "pins", "hexes", "hexes-flat"]}
      focus={focus}
    />
  );
}
