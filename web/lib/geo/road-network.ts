import type { LatLng } from "./districts";
import data from "./road-network.json";

/**
 * Semua jalan utama di wilayah yang punya kamera, dari OpenStreetMap (© kontributor OpenStreetMap, ODbL),
 * ditulis oleh `worker/scripts/build_road_segments.py`. Tiap garis mencatat beberapa kamera lalu lintas
 * terdekatnya. Jalan yang tidak punya kamera diwarnai sebagai PERKIRAAN dari kamera terdekat yang sedang
 * punya nilai, dan digambar lebih pudar bila kameranya jauh; ini bukan hasil pengamatan jalan itu.
 * Berkasnya besar, jadi hanya diimpor oleh komponen peta yang dimuat belakangan.
 */
const lines = data.lines as unknown as LatLng[][];
const near = data.near as number[][]; // per garis: [indeks kamera, jarak m, ...], yang terdekat lebih dulu
const cameraIds = data.cameras as string[];

/** Di atas jarak ini ke kamera pemberi warna, garis digambar pudar. */
export const NETWORK_FAR_M = 1500;

export type NetworkGroup = { tone: string; far: boolean; lines: LatLng[][] };

/**
 * Kelompokkan garis jaringan menurut warna yang diwarisinya. `tones` berisi kelas warna tiap kamera yang
 * sedang punya nilai; garis memakai kamera terdekat yang ada di sana. Garis yang semua kamera terdekatnya
 * tidak punya nilai masuk kelompok `fallback`.
 */
export function paintNetwork(tones: ReadonlyMap<string, string>, fallback: string): NetworkGroup[] {
  const groups = new Map<string, NetworkGroup>();
  lines.forEach((line, index) => {
    const candidates = near[index];
    let tone = fallback;
    let far = false;
    for (let i = 0; i < candidates.length; i += 2) {
      const found = tones.get(cameraIds[candidates[i]]);
      if (found) {
        tone = found;
        far = candidates[i + 1] > NETWORK_FAR_M;
        break;
      }
    }
    const key = `${tone}-${far}`;
    const group = groups.get(key) ?? { tone, far, lines: [] };
    group.lines.push(line);
    groups.set(key, group);
  });
  return [...groups.values()];
}
