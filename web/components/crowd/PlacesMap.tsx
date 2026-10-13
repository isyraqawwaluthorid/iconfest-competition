"use client";

import L from "leaflet";
import { Fragment, useMemo } from "react";
import { AttributionControl, CircleMarker, MapContainer, TileLayer, Tooltip, ZoomControl } from "react-leaflet";
import { BASEMAP } from "@/lib/map-tiles";
import { CROWD, type PlaceView } from "@/lib/public-places";

type Props = {
  places: PlaceView[];
  onSelect: (placeId: string) => void;
};

// Selisih ukuran sengaja dibuat kecil: tempat dengan satu-dua kamera tidak boleh tampak "kalah" hanya karena
// kameranya lebih sedikit. Perbandingan yang adil ada di daftar per titik di sebelah peta.
const MIN_RADIUS = 11;
const MAX_RADIUS = 18;

/** Peta kecil halaman Ruang publik: satu pin per tempat, besarnya mengikuti jumlah pejalan kaki yang terlihat. Hanya dirender di browser. */
export default function PlacesMap({ places, onSelect }: Props) {
  // Bingkai awal dihitung sekali; pembaruan hitungan tidak boleh menggeser peta.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const bounds = useMemo(() => L.latLngBounds(places.map((place) => place.center)).pad(0.35), []);
  const most = Math.max(...places.map((place) => place.now), 1);

  return (
    <MapContainer bounds={bounds} zoomSnap={0.25} maxZoom={17} zoomControl={false} attributionControl={false} scrollWheelZoom={false} className="road-map h-full w-full">
      <TileLayer {...BASEMAP} />
      <AttributionControl position="bottomleft" />
      <ZoomControl position="topright" />
      {places.map((place) => {
        const status = CROWD[place.level];
        // Label diletakkan menjauhi tempat terdekat, supaya dua tempat yang berdekatan tidak saling menutupi.
        const nearest = places
          .filter((other) => other.id !== place.id)
          .sort((a, b) => Math.hypot(a.center[0] - place.center[0], a.center[1] - place.center[1]) - Math.hypot(b.center[0] - place.center[0], b.center[1] - place.center[1]))[0];
        const side = nearest && nearest.center[1] > place.center[1] ? "left" : "right";
        // Luas lingkaran, bukan jari-jarinya, yang sebanding dengan jumlah orang.
        const radius = MIN_RADIUS + (MAX_RADIUS - MIN_RADIUS) * Math.sqrt(place.now / most);
        return (
          <Fragment key={`${place.id}-${status.tone}`}>
            <CircleMarker center={place.center} radius={radius + 7} className={`camera-halo tone-${status.tone}`} interactive={false} />
            <CircleMarker
              center={place.center}
              radius={radius}
              className={`camera-marker tone-${status.tone}`}
              eventHandlers={{ click: () => onSelect(place.id) }}
            >
              <Tooltip permanent direction={side} offset={[side === "left" ? -radius : radius, 0]} className="site-label">
                <strong>{place.name}</strong>
                <br />
                {place.online === 0 ? "kamera mati" : `${place.now} pejalan kaki${place.level !== "tidak_diketahui" ? ` · ${status.label.toLowerCase()}` : ""}`}
              </Tooltip>
            </CircleMarker>
          </Fragment>
        );
      })}
    </MapContainer>
  );
}
