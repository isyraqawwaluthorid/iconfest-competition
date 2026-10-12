import { VEHICLE_CLASSES, type RoadRow } from "./traffic";
import { isOnline } from "./status";

/**
 * Lapisan "Beban emisi": estimasi RELATIF beban emisi tiap ruas, untuk membandingkan ruas satu dengan lainnya.
 * Dihitung dari kendaraan yang terlihat pada gambar (rata-rata 30 menit terakhir), ditimbang faktor emisi per
 * jenis kendaraan. Ini bukan pengukuran dan bukan kg per jam: sistem hanya tahu berapa kendaraan yang terlihat,
 * bukan berapa yang lewat. Sepeda motor juga sering tidak terhitung, jadi porsinya di sini terlalu kecil.
 *
 * Faktor emisi (gram per kendaraan per km) dari Permen LH No. 12/2010; rinciannya di docs/12-emisi-kualitas-udara.md.
 * Mobil dianggap 88% bensin dan 12% solar. CO₂ diturunkan dari faktor per kg BBM dengan asumsi konsumsi BBM
 * (motor 40 km/l, mobil 12 km/l, bus 4 km/l, truk 5 km/l).
 */
export type Pollutant = "co2" | "nox" | "co";
type VehicleKey = (typeof VEHICLE_CLASSES)[number]["key"];

export const POLLUTANTS: { id: Pollutant; label: string; factors: Record<VehicleKey, number> }[] = [
  { id: "co2", label: "CO₂", factors: { motorcycles: 58.8, cars: 199.2, buses: 666.1, trucks: 532.9 } },
  { id: "nox", label: "NOx", factors: { motorcycles: 0.29, cars: 2.18, buses: 11.9, trucks: 17.7 } },
  { id: "co", label: "CO", factors: { motorcycles: 14, cars: 35.5, buses: 11, trucks: 8.4 } },
];

export const EMISSION_WINDOW_MINUTES = 30;
export const EMISSION_LEVELS = ["Sangat ringan", "Ringan", "Sedang", "Berat", "Sangat berat"];

/** Hitungan per jenis kendaraan pada satu gambar (tabel `traffic_readings`). */
export type ClassCounts = { camera_id: string; captured_at: string } & Record<VehicleKey, number>;

export type EmissionRow = {
  row: RoadRow;
  /** Jumlah gambar yang dirata-ratakan. */
  frames: number;
  /** Beban relatif dalam "setara sepeda motor": berapa sepeda motor yang emisinya sama dengan kendaraan yang terlihat. */
  motorEquivalent: number;
  /** Porsi tiap jenis kendaraan terhadap beban ruas ini. */
  shares: { key: VehicleKey; label: string; share: number }[];
  /** 1 (paling ringan) sampai 5 (paling berat), dibanding ruas lain saat ini. */
  level: number;
};

/** Ruas dengan beban terberat lebih dulu. Ruas yang kameranya mati atau tanpa gambar dalam jendela waktu tidak ikut. */
export function emissionRows(rows: RoadRow[], readings: ClassCounts[], pollutant: Pollutant): EmissionRow[] {
  const factors = (POLLUTANTS.find((item) => item.id === pollutant) ?? POLLUTANTS[0]).factors;
  const byCamera = new Map<string, ClassCounts[]>();
  for (const reading of readings) byCamera.set(reading.camera_id, [...(byCamera.get(reading.camera_id) ?? []), reading]);

  const loaded = rows.flatMap((row) => {
    const frames = byCamera.get(row.camera.id) ?? [];
    if (!isOnline(row.camera) || frames.length === 0) return [];
    const parts = VEHICLE_CLASSES.map((item) => ({
      key: item.key,
      label: item.label,
      load: (frames.reduce((sum, frame) => sum + frame[item.key], 0) / frames.length) * factors[item.key],
    }));
    const load = parts.reduce((sum, part) => sum + part.load, 0);
    return [
      {
        row,
        frames: frames.length,
        load,
        motorEquivalent: load / factors.motorcycles,
        shares: parts.map(({ key, label, load: part }) => ({ key, label, share: load > 0 ? part / load : 0 })),
      },
    ];
  });

  const sorted = loaded.map((item) => item.load).sort((a, b) => a - b);
  const breaks = EMISSION_LEVELS.slice(1).map((_, i) => sorted[Math.floor(((i + 1) * sorted.length) / EMISSION_LEVELS.length)]);
  return loaded
    .sort((a, b) => b.load - a.load)
    .map(({ load, ...item }) => ({ ...item, level: 1 + breaks.filter((limit) => load > 0 && load >= limit).length }));
}

/** Porsi tiap jenis kendaraan terhadap beban semua ruas, ditimbang besar beban tiap ruas. */
export function citywideShares(rows: EmissionRow[]): EmissionRow["shares"] {
  const total = rows.reduce((sum, item) => sum + item.motorEquivalent, 0);
  return VEHICLE_CLASSES.map((item) => ({
    key: item.key,
    label: item.label,
    share:
      total > 0
        ? rows.reduce((sum, row) => sum + row.motorEquivalent * (row.shares.find((s) => s.key === item.key)?.share ?? 0), 0) / total
        : 0,
  }));
}
