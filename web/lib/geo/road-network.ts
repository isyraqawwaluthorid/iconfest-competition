import type { LatLng } from "./districts";
import data from "./road-network.json";

/**
 * Semua jalan utama di wilayah yang punya kamera, dari OpenStreetMap (© kontributor OpenStreetMap, ODbL),
 * ditulis oleh `worker/scripts/build_road_segments.py`. Digambar tanpa warna sebagai latar halaman Lalu Lintas,
 * supaya jalan yang tidak punya kamera terlihat sebagai "tidak terpantau", bukan hilang.
 * Berkasnya besar, jadi hanya diimpor oleh komponen peta yang dimuat belakangan.
 */
export const ROAD_NETWORK = data.lines as unknown as LatLng[][];
