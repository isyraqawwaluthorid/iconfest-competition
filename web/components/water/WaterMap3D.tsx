"use client";

import { useMemo } from "react";
import GlMap, { LABEL_FONT, type GlFocus, type GlLayer } from "@/components/map/GlMap";
import { boundsAround, boundsOf, collection, point, toneColor, type Properties } from "@/lib/map-gl";
import { useMapTheme } from "@/lib/map-theme";
import { WATER } from "@/lib/status";
import type { WaterRow } from "@/lib/water";

type Props = {
  rows: WaterRow[];
  selected: string | null;
  onSelect: (cameraId: string) => void;
};

/** Peta halaman Air versi 3D: satu pin per lokasi air, berwarna status resminya. Isinya sama dengan `WaterMap`. */
export default function WaterMap3D({ rows, selected, onSelect }: Props) {
  const mapTheme = useMapTheme();
  const dark = mapTheme === "dark";
  // Bingkai awal dihitung sekali; pembaruan status tidak mengubah letak lokasi.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => boundsOf(rows.map((row) => [row.camera.lat, row.camera.lng])), []);

  const sources = useMemo(() => {
    // Yang digambar belakangan berada di atas: lokasi normal dulu, yang naik atau menunggu konfirmasi terakhir.
    const sites = [...rows].reverse().map(({ camera, status, pending }) => {
      const raised = status.tone === "waspada" || status.tone === "siaga" || status.tone === "awas";
      const active = camera.id === selected;
      const label = pending
        ? `${camera.name}\nResmi: ${status.label.toLowerCase()} · indikasi ${WATER[pending].label.toLowerCase()}`
        : raised
          ? `${camera.name}\n${status.label}`
          : "";
      return point([camera.lat, camera.lng], {
        id: camera.id,
        color: toneColor(pending ? WATER[pending].tone : status.tone),
        r: active ? 9 : pending || raised ? 8 : 6.5,
        stroke: active || pending || raised ? (dark ? "#ffffff" : "#18181b") : "#ffffff",
        strokeWidth: active || pending ? 2.5 : 2,
        label,
        tip: label ? "" : `${camera.name} · ${status.label}`,
      });
    });
    return { sites: collection(sites) };
  }, [rows, selected, dark]);

  const layers = useMemo<GlLayer[]>(
    () => [
      {
        id: "sites-halo",
        type: "circle",
        source: "sites",
        paint: { "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["*", ["get", "r"], 1.6], 16, ["*", ["get", "r"], 3.2]] },
      },
      {
        id: "sites",
        type: "circle",
        source: "sites",
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, ["get", "r"], 16, ["*", ["get", "r"], 2]],
          "circle-stroke-color": ["get", "stroke"],
          "circle-stroke-width": ["get", "strokeWidth"],
        },
      },
      // Lokasi yang bergerak diberi label tetap, supaya terlihat tanpa harus diarahkan kursor.
      {
        id: "site-labels",
        type: "symbol",
        source: "sites",
        filter: ["!=", ["get", "label"], ""],
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11, "text-variable-anchor": ["bottom", "top", "right", "left"], "text-radial-offset": 1.4, "text-justify": "auto", "symbol-sort-key": ["-", 0, ["get", "r"]] },
        paint: { "text-color": dark ? "#ffffff" : "#18181b", "text-halo-color": dark ? "#15171c" : "#ffffff", "text-halo-width": 2 },
      },
    ],
    [dark],
  );

  const focus = useMemo<GlFocus | null>(() => {
    const site = rows.find((row) => row.camera.id === selected)?.camera;
    return site ? { key: site.id, bounds: boundsAround([site.lat, site.lng], 350), maxZoom: 16.5 } : null;
    // Hanya saat pilihan berganti; pembaruan data tidak boleh menggeser peta yang sedang dilihat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const handlers = useMemo(() => ({ sites: (properties: Properties) => typeof properties.id === "string" && onSelect(properties.id) }), [onSelect]);

  return (
    <GlMap
      theme={mapTheme}
      bounds={bounds}
      panels
      sources={sources}
      layers={layers}
      layersKey={String(dark)}
      onFeatureClick={handlers}
      tipLayers={["sites"]}
      focus={focus}
    />
  );
}
