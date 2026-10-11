import collection from "./kecamatan-semarang.json";

/**
 * Batas 16 kecamatan Kota Semarang, disederhanakan dari OpenStreetMap (© kontributor OpenStreetMap, ODbL).
 * Kecamatan adalah satuan wilayah untuk semua ringkasan di peta tematik.
 */

export type LatLng = [number, number];
/** Bentuk yang diterima `Polygon` Leaflet untuk multipoligon: poligon → cincin → titik. */
export type District = { name: string; polygons: LatLng[][][]; center: LatLng };

type Position = [number, number]; // [bujur, lintang] sesuai GeoJSON
type Feature = {
  properties: { name: string };
  geometry: { type: "Polygon"; coordinates: Position[][] } | { type: "MultiPolygon"; coordinates: Position[][][] };
};

function toDistrict(feature: Feature): District {
  const { geometry } = feature;
  const source = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.coordinates;
  const polygons = source.map((rings) => rings.map((ring) => ring.map(([lng, lat]): LatLng => [lat, lng])));
  const outline = polygons[0][0];
  const center: LatLng = [
    outline.reduce((sum, p) => sum + p[0], 0) / outline.length,
    outline.reduce((sum, p) => sum + p[1], 0) / outline.length,
  ];
  return { name: feature.properties.name, polygons, center };
}

export const DISTRICTS: District[] = (collection.features as unknown as Feature[]).map(toDistrict);

const outlinePoints = DISTRICTS.flatMap((district) => district.polygons.flatMap((polygon) => polygon[0]));

/** Kotak pembatas seluruh kota: [barat daya, timur laut], untuk membingkai peta. */
export const CITY_BOUNDS: [LatLng, LatLng] = [
  [Math.min(...outlinePoints.map((p) => p[0])), Math.min(...outlinePoints.map((p) => p[1]))],
  [Math.max(...outlinePoints.map((p) => p[0])), Math.max(...outlinePoints.map((p) => p[1]))],
];

function insideRing(lat: number, lng: number, ring: LatLng[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [latI, lngI] = ring[i];
    const [latJ, lngJ] = ring[j];
    if (latI > lat !== latJ > lat && lng < ((lngJ - lngI) * (lat - latI)) / (latJ - latI) + lngI) inside = !inside;
  }
  return inside;
}

/** Nama kecamatan yang memuat titik ini, atau null jika di luar batas kota. */
export function districtOf(lat: number, lng: number): string | null {
  for (const district of DISTRICTS) {
    for (const [outer, ...holes] of district.polygons) {
      if (insideRing(lat, lng, outer) && !holes.some((hole) => insideRing(lat, lng, hole))) return district.name;
    }
  }
  return null;
}
