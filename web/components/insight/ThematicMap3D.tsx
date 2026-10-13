"use client";

import { useMemo } from "react";
import GlMap, { LABEL_FONT, type GlFocus, type GlLayer } from "@/components/map/GlMap";
import { CITY_BOUNDS, districtOf, DISTRICTS, shortName } from "@/lib/geo/districts";
import { themeDisplay, type DistrictSummary, type Theme } from "@/lib/insight";
import { boundsOf, collection, multiPolygon, point, toneColor, tokenColor, type Properties } from "@/lib/map-gl";
import { useMapTheme } from "@/lib/map-theme";
import { DENSITY, isElevated, NOT_ASSESSED, trashDisplay, WATER } from "@/lib/status";
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

/** Ukuran dan label mengikuti zoom lewat properti `r` tiap titik. */
const RADIUS: GlLayer["paint"] = {
  "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, ["get", "r"], 15, ["*", ["get", "r"], 1.8]],
};

/** Peta tematik per kecamatan versi 3D. Isi dan aturannya sama dengan `ThematicMap` (versi datar). */
export default function ThematicMap3D({ summaries, theme, sources, pending, selected, onSelect }: Props) {
  const mapTheme = useMapTheme();
  const dark = mapTheme === "dark";

  const data = useMemo(() => {
    const outline = dark ? "#ffffff" : tokenColor("--muted", "#5f6270");
    const districts = summaries.map((summary) => {
      const display = themeDisplay(summary, theme);
      const untracked = display.tone === "untracked";
      const isSelected = summary.district.name === selected;
      return multiPolygon(summary.district.polygons, {
        name: summary.district.name,
        color: toneColor(display.tone),
        // Wilayah tanpa sumber data hanya digambar garis batasnya, tidak pernah diberi warna status.
        // Cukup tembus pandang supaya jalan dan nama tempat di bawahnya tetap terbaca, di peta terang maupun gelap.
        opacity: untracked ? (isSelected ? 0.18 : 0) : isSelected ? (dark ? 0.7 : 0.62) : dark ? 0.45 : 0.4,
        line: isSelected ? tokenColor("--primary-strong", "#1d4ed8") : outline,
        width: isSelected ? 3.5 : 1.8,
        tip: `${summary.district.name} · ${display.label}`,
      });
    });
    const labels = DISTRICTS.map((district) => point(district.center, { label: shortName(district.name).toUpperCase() }));
    const weight = (camera: CameraOverview) =>
      theme === "trash" ? Number(camera.trash === "banyak") : theme !== "risk" ? 0 : pending.has(camera.id) ? 2 : isElevated(camera.water_status) ? 1 : 0;
    const sites = [...sources]
      .sort((a, b) => weight(a) - weight(b))
      .map((camera) => {
        const status =
          theme === "risk"
            ? camera.water_status
              ? WATER[camera.water_status]
              : NOT_ASSESSED
            : theme === "trash"
              ? (trashDisplay(camera.trash) ?? NOT_ASSESSED)
              : DENSITY[camera.density_level ?? "tidak_diketahui"];
        const waiting = theme === "risk" ? pending.get(camera.id) : undefined;
        const raised = theme === "risk" ? isElevated(camera.water_status) : theme === "trash" && camera.trash === "banyak";
        const text = waiting
          ? `${camera.name}\nResmi: ${status.label.toLowerCase()} · indikasi ${WATER[waiting].label.toLowerCase()} (1 dari 2)`
          : raised
            ? `${camera.name}\n${theme === "trash" ? "Sampah banyak" : status.label}`
            : "";
        return point([camera.lat, camera.lng], {
          id: camera.id,
          color: toneColor(waiting ? WATER[waiting].tone : status.tone),
          r: waiting ? 9 : raised ? 7 : 3.5,
          stroke: waiting || raised ? (dark ? "#ffffff" : "#18181b") : "#ffffff",
          strokeWidth: waiting ? 2.5 : raised ? 2 : 1.2,
          pending: Boolean(waiting),
          label: text,
          tip: text ? "" : `${camera.name} · ${theme === "trash" ? `sampah ${status.label.toLowerCase()}` : status.label}`,
        });
      });
    return { districts: collection(districts), "district-labels": collection(labels), sites: collection(sites) };
  }, [summaries, theme, sources, pending, selected, dark]);

  const layers = useMemo<GlLayer[]>(() => {
    const text = dark ? "#ffffff" : "#18181b";
    const halo = dark ? "#15171c" : "#ffffff";
    return [
      { id: "districts", type: "fill", source: "districts", under: "buildings", paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] } },
      { id: "district-lines", type: "line", source: "districts", under: "buildings", paint: { "line-color": ["get", "line"], "line-width": ["get", "width"], "line-opacity": 0.9 } },
      {
        id: "district-labels",
        type: "symbol",
        source: "district-labels",
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11, "text-letter-spacing": 0.05 },
        paint: { "text-color": text, "text-halo-color": halo, "text-halo-width": 1.6 },
      },
      // Menunggu konfirmasi: cincin tembus pandang di sekeliling titik, supaya menonjol tanpa menutupi warna levelnya.
      {
        id: "sites-pending",
        type: "circle",
        source: "sites",
        filter: ["==", ["get", "pending"], true],
        paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 15, 15, 30], "circle-color": ["get", "color"], "circle-opacity": 0.3 },
      },
      {
        id: "sites",
        type: "circle",
        source: "sites",
        paint: { ...RADIUS, "circle-color": ["get", "color"], "circle-stroke-color": ["get", "stroke"], "circle-stroke-width": ["get", "strokeWidth"] },
      },
      {
        id: "site-labels",
        type: "symbol",
        source: "sites",
        filter: ["!=", ["get", "label"], ""],
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 11, "text-offset": [0, -2.4], "text-anchor": "bottom", "text-allow-overlap": true },
        paint: { "text-color": text, "text-halo-color": halo, "text-halo-width": 2 },
      },
    ];
  }, [dark]);

  const focus = useMemo<GlFocus>(() => {
    const district = DISTRICTS.find((item) => item.name === selected);
    return district
      ? { key: district.name, bounds: boundsOf(district.polygons.flatMap((polygon) => polygon[0])), maxZoom: 14 }
      : { key: "kota", bounds: CITY_BOUNDS };
  }, [selected]);

  const handlers = useMemo(
    () => ({
      sites: (properties: Properties) => {
        const camera = sources.find((item) => item.id === properties.id);
        const district = camera ? districtOf(camera.lat, camera.lng) : null;
        if (district) onSelect(district);
      },
      districts: (properties: Properties) => {
        if (typeof properties.name === "string") onSelect(properties.name);
      },
    }),
    [sources, onSelect],
  );

  return (
    <GlMap
      theme={mapTheme}
      bounds={CITY_BOUNDS}
      panels
      pitch={42}
      sources={data}
      layers={layers}
      layersKey={dark ? "gelap" : "terang"}
      onFeatureClick={handlers}
      tipLayers={["sites", "districts"]}
      focus={focus}
    />
  );
}
