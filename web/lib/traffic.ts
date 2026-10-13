import { ROAD_SEGMENTS, type RoadSegment } from "./geo/roads";
import { DENSITY, healthOf, isOnline, type StatusDisplay, type Tone } from "./status";
import type { CameraOverview, DensityLevel, TrafficPoint } from "./types";

/**
 * Halaman Lalu Lintas: satu baris per ruas jalan yang punya kamera. Tingkat kepadatan sebuah ruas adalah
 * tingkat kamera yang melihatnya, yaitu jumlah kendaraan terlihat dibanding kebiasaan kamera itu pada jam
 * yang sama. Ini bukan kecepatan dan bukan jumlah kendaraan yang lewat.
 */
export type RoadRow = {
  camera: CameraOverview;
  segment: RoadSegment;
  /** Nama jalan, atau nama kamera bila jalannya tidak bernama. */
  title: string;
  status: StatusDisplay;
  /** Kamera hidup dan sudah punya pembanding, jadi tingkatnya bisa dipercaya sebagai kondisi sekarang. */
  measured: boolean;
};

const LEVEL_ORDER: DensityLevel[] = ["padat", "ramai", "normal", "lancar"];
const BUSY_INDEX = 1.3; // batas bawah "ramai" di worker (fusion/baseline.py)

/** Ruas yang paling padat lebih dulu; ruas tanpa pembanding dan kamera mati di akhir. */
export function roadRows(cameras: CameraOverview[]): RoadRow[] {
  const rows = cameras.flatMap((camera): RoadRow[] => {
    const segment = ROAD_SEGMENTS.get(camera.id);
    if (!segment || !camera.modules.includes("traffic")) return [];
    const online = isOnline(camera);
    const level = camera.density_level ?? "tidak_diketahui";
    return [
      {
        camera,
        segment,
        title: segment.road_name || camera.name,
        status: online ? DENSITY[level] : healthOf(camera),
        measured: online && camera.density_index != null && level !== "tidak_diketahui",
      },
    ];
  });
  // Urut menurut tingkat dulu, baru indeks: ruas lengang yang "empat kali kebiasaan" tidak mendahului ruas yang benar-benar padat.
  const rank = (row: RoadRow) =>
    row.measured ? LEVEL_ORDER.indexOf(row.camera.density_level as DensityLevel) : isOnline(row.camera) ? LEVEL_ORDER.length : LEVEL_ORDER.length + 1;
  return rows.sort(
    (a, b) => rank(a) - rank(b) || (b.camera.density_index ?? 0) - (a.camera.density_index ?? 0) || a.title.localeCompare(b.title),
  );
}

const SAME_SPOT_M = 30; // kamera sedekat ini berdiri di tiang atau simpang yang sama
const M_PER_DEG = 111_320;

/** Satu pin di peta: satu kamera, atau beberapa kamera yang berdiri di tempat yang sama (digambar berangka). */
export type Pin = { center: [number, number]; members: RoadRow[] };

/** Gabungkan kamera yang setempat. Urutan `rows` dipertahankan, jadi anggota pertama tiap pin adalah yang terdepan di `rows`. */
export function groupPins(rows: RoadRow[]): Pin[] {
  const pins: Pin[] = [];
  for (const row of rows) {
    const { lat, lng } = row.camera;
    const near = pins.find(
      (pin) =>
        Math.hypot((pin.center[0] - lat) * M_PER_DEG, (pin.center[1] - lng) * M_PER_DEG * Math.cos((lat * Math.PI) / 180)) <= SAME_SPOT_M,
    );
    if (near) near.members.push(row);
    else pins.push({ center: [lat, lng], members: [row] });
  }
  return pins;
}

/** Indeks di atas batas "ramai" tetapi tingkatnya tidak naik: kendaraannya lebih banyak dari biasanya, namun masih sedikit. */
export function isFewButAboveUsual(camera: CameraOverview): boolean {
  return (camera.density_index ?? 0) >= BUSY_INDEX && (camera.density_level === "normal" || camera.density_level === "lancar");
}

export type TrafficSituation = {
  tone: Tone;
  headline: string;
  detail: string;
  /** Jumlah ruas per tingkat, dari yang paling padat, untuk batang sebaran. */
  counts: { level: DensityLevel; status: StatusDisplay; count: number }[];
  measured: number;
  unmeasured: number;
  provisional: boolean;
};

/** Kalimat ringkas kondisi lalu lintas, disusun dari aturan agar selalu tersedia dan konsisten. */
export function trafficSituation(rows: RoadRow[]): TrafficSituation {
  const measured = rows.filter((row) => row.measured);
  const counts = LEVEL_ORDER.map((level) => ({
    level,
    status: DENSITY[level],
    count: measured.filter((row) => row.camera.density_level === level).length,
  }));
  const [dense, busy] = [counts[0].count, counts[1].count];
  const base = {
    counts,
    measured: measured.length,
    unmeasured: rows.length - measured.length,
    provisional: measured.some((row) => row.camera.baseline_is_provisional),
  };
  if (measured.length === 0) {
    // Kamera hidup tetapi tanpa pembanding: sistem baru mulai, atau model penghitungnya baru diganti.
    const collecting = rows.some((row) => isOnline(row.camera));
    return {
      ...base,
      tone: "unknown",
      headline: collecting ? "Pembanding sedang dikumpulkan" : "Belum ada ruas yang bisa dinilai",
      detail: collecting
        ? "Kepadatan dinilai terhadap kebiasaan tiap ruas pada jam yang sama di hari sebelumnya. Pembanding itu baru tersedia setelah sehari data, jadi untuk sementara ruas belum diberi tingkat. Kendaraan tetap dihitung."
        : "Kamera lalu lintas sedang tidak mengirim gambar.",
    };
  }
  if (dense + busy === 0) {
    return {
      ...base,
      tone: "density-lancar",
      headline: "Semua ruas lancar atau normal",
      detail: `Tidak ada dari ${measured.length} ruas terpantau yang lebih padat dari biasanya pada jam ini.`,
    };
  }
  const parts = [dense > 0 ? `${dense} padat` : "", busy > 0 ? `${busy} ramai` : ""].filter(Boolean).join(" dan ");
  return {
    ...base,
    tone: dense > 0 ? "density-padat" : "density-ramai",
    headline: `${dense + busy} dari ${measured.length} ruas lebih padat dari biasanya`,
    detail: `${parts}, dibanding ruas itu sendiri pada jam yang sama di hari-hari sebelumnya.`,
  };
}

/** Jumlah kendaraan yang biasanya terlihat kamera ini pada jam yang sama, dihitung balik dari indeksnya. */
export function usualCount(camera: CameraOverview): number | null {
  if (camera.vehicle_count == null || !camera.density_index) return null;
  return Math.round(camera.vehicle_count / camera.density_index);
}

export const VEHICLE_CLASSES = [
  { key: "motorcycles", label: "Sepeda motor" },
  { key: "cars", label: "Mobil" },
  { key: "buses", label: "Bus" },
  { key: "trucks", label: "Truk" },
] as const;

export type VehicleShare = { key: (typeof VEHICLE_CLASSES)[number]["key"]; label: string; count: number; share: number };

/** Porsi tiap jenis kendaraan yang terlihat sejak `since` (ms). `null` bila tidak ada kendaraan terlihat. */
export function composition(points: TrafficPoint[], since: number): VehicleShare[] | null {
  const recent = points.filter((point) => new Date(point.captured_at).getTime() >= since);
  const counted = VEHICLE_CLASSES.map((item) => ({ ...item, count: recent.reduce((sum, point) => sum + point[item.key], 0) }));
  const total = counted.reduce((sum, item) => sum + item.count, 0);
  return total === 0 ? null : counted.map((item) => ({ ...item, share: item.count / total }));
}
