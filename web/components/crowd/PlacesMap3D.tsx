"use client";

import { useMemo } from "react";
import GlMap, { LABEL_FONT, type GlLayer } from "@/components/map/GlMap";
import { boundsOf, collection, point, toneColor, type Properties } from "@/lib/map-gl";
import { useMapTheme } from "@/lib/map-theme";
import { CROWD, type PlaceView } from "@/lib/public-places";

type Props = {
  places: PlaceView[];
  onSelect: (placeId: string) => void;
};

// Selisih ukuran sengaja dibuat kecil: tempat dengan satu-dua kamera tidak boleh tampak "kalah" hanya karena
// kameranya lebih sedikit. Perbandingan yang adil ada di daftar per titik di sebelah peta.
const MIN_RADIUS = 11;
const MAX_RADIUS = 18;

/** Peta kecil halaman Ruang publik versi 3D: satu pin berlabel per tempat. Isinya sama dengan `PlacesMap`. */
export default function PlacesMap3D({ places, onSelect }: Props) {
  const mapTheme = useMapTheme();
  const dark = mapTheme === "dark";
  // Bingkai awal dihitung sekali; pembaruan hitungan tidak boleh menggeser peta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => boundsOf(places.map((place) => place.center)), []);

  const sources = useMemo(() => {
    const most = Math.max(...places.map((place) => place.now), 1);
    return {
      places: collection(
        places.map((place) => {
          const status = CROWD[place.level];
          const detail = place.online === 0 ? "kamera mati" : `${place.now} pejalan kaki${place.level !== "tidak_diketahui" ? ` · ${status.label.toLowerCase()}` : ""}`;
          return point(place.center, {
            id: place.id,
            color: toneColor(status.tone),
            // Luas lingkaran, bukan jari-jarinya, yang sebanding dengan jumlah orang.
            r: MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(place.now / most),
            label: `${place.name}\n${detail}`,
          });
        }),
      ),
    };
  }, [places]);

  const layers = useMemo<GlLayer[]>(
    () => [
      { id: "places-halo", type: "circle", source: "places", paint: { "circle-color": ["get", "color"], "circle-opacity": 0.3, "circle-radius": ["+", ["get", "r"], 7] } },
      { id: "places", type: "circle", source: "places", paint: { "circle-color": ["get", "color"], "circle-radius": ["get", "r"], "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } },
      {
        id: "place-labels",
        type: "symbol",
        source: "places",
        layout: { "text-field": ["get", "label"], "text-font": LABEL_FONT, "text-size": 12, "text-offset": [2.4, 0], "text-anchor": "left", "text-justify": "left", "text-allow-overlap": true },
        paint: { "text-color": dark ? "#ffffff" : "#18181b", "text-halo-color": dark ? "#15171c" : "#ffffff", "text-halo-width": 2 },
      },
    ],
    [dark],
  );
  const handlers = useMemo(() => ({ places: (properties: Properties) => typeof properties.id === "string" && onSelect(properties.id) }), [onSelect]);

  return <GlMap theme={mapTheme} bounds={bounds} pitch={35} sources={sources} layers={layers} layersKey={String(dark)} onFeatureClick={handlers} navigation="top-right" />;
}
