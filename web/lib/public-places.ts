import type { ActivityProfile } from "./activity";
import { isOnline, type StatusDisplay } from "./status";
import type { CameraOverview } from "./types";

/**
 * Keramaian ruang publik: beberapa kamera yang menghadap ruang pejalan kaki dikelompokkan menjadi satu tempat.
 * Yang dihitung adalah pejalan kaki yang terlihat pada gambar terakhir (worker membuang orang yang terdeteksi
 * sedang menaiki sepeda motor), dibanding rata-rata tempat itu pada jam yang sama di hari-hari sebelumnya.
 * Ini bukan jumlah pengunjung, dan tidak ada pengenalan wajah.
 *
 * Hanya tempat yang kameranya sudah diperiksa menghadap ruang pejalan kaki yang didaftarkan. Kamera "Titik Nol"
 * dan "Pintu Masuk Lawang Sewu" berkategori pariwisata tetapi ternyata menghadap jalan raya, jadi tidak dipakai.
 */
type PlaceDefinition = { id: string; name: string; about: string; center: [number, number]; radiusM: number; exclude?: string[] };

const PLACES: PlaceDefinition[] = [
  {
    id: "kota-lama",
    name: "Kota Lama",
    about: "Kawasan wisata: Taman Srigunting, Gereja Blenduk, dan Jalan Letjen Suprapto.",
    center: [-6.9681, 110.4278],
    radiusM: 150,
  },
  {
    id: "balai-kota",
    name: "Balai Kota",
    about: "Halaman dan pintu masuk-keluar kantor Pemerintah Kota Semarang.",
    center: [-6.9813, 110.4126],
    radiusM: 150,
  },
];

const M_PER_DEG = 111_320;
const LEVEL_BOUNDS: [number, CrowdLevel][] = [
  [0.8, "sepi"],
  [1.3, "biasa"],
  [1.8, "ramai"],
];
/** Di bawah jumlah ini sebuah tempat belum disebut ramai, berapa pun kelipatannya dari biasanya. */
const MIN_BUSY_PEOPLE = 10;
/** Pembanding dari kurang dari tiga hari diberi label sementara, sama seperti lalu lintas. */
const MIN_DAYS = 3;

export type CrowdLevel = "sepi" | "biasa" | "ramai" | "sangat_ramai" | "tidak_diketahui";

export const CROWD: Record<CrowdLevel, StatusDisplay> = {
  sepi: { label: "Sepi", tone: "density-lancar" },
  biasa: { label: "Biasa", tone: "density-normal" },
  ramai: { label: "Ramai", tone: "density-ramai" },
  sangat_ramai: { label: "Sangat ramai", tone: "density-padat" },
  tidak_diketahui: { label: "Belum ada pembanding", tone: "unknown" },
};

export type PlaceView = {
  id: string;
  name: string;
  about: string;
  /** Kamera tempat ini, yang paling banyak orangnya lebih dulu. */
  cameras: CameraOverview[];
  online: number;
  /** Pejalan kaki terlihat pada gambar terakhir semua kamera yang hidup. */
  now: number;
  /** Rata-rata pada jam ini di hari-hari sebelumnya; `null` bila jam ini belum punya data. */
  usual: number | null;
  level: CrowdLevel;
  provisional: boolean;
  /** Rata-rata per jam (0–23) dijumlahkan antar kamera; `null` untuk jam yang belum punya data. */
  hourly: (number | null)[];
  latest: string | null;
};

function distanceM(a: [number, number], lat: number, lng: number): number {
  return Math.hypot((a[0] - lat) * M_PER_DEG, (a[1] - lng) * M_PER_DEG * Math.cos((lat * Math.PI) / 180));
}

function levelOf(now: number, usual: number | null): CrowdLevel {
  if (usual === null) return "tidak_diketahui";
  const ratio = now / Math.max(usual, 1);
  const level = LEVEL_BOUNDS.find(([upper]) => ratio < upper)?.[1] ?? "sangat_ramai";
  return (level === "ramai" || level === "sangat_ramai") && now < MIN_BUSY_PEOPLE ? "biasa" : level;
}

/** Keadaan tiap tempat pada jam `hour` (WIB). Tempat tanpa kamera aktif di database tidak ikut. */
export function placeViews(cameras: CameraOverview[], profile: ActivityProfile | null, hour: number): PlaceView[] {
  return PLACES.flatMap((place): PlaceView[] => {
    const members = cameras
      .filter((camera) => camera.modules.includes("crowd") && distanceM(place.center, camera.lat, camera.lng) <= place.radiusM)
      .sort((a, b) => (b.person_count ?? 0) - (a.person_count ?? 0) || a.name.localeCompare(b.name));
    if (members.length === 0) return [];
    const live = members.filter(isOnline);
    const hourly = Array.from({ length: 24 }, (_, h) => {
      const values = members.flatMap((camera) => profile?.cameras[camera.id]?.persons[h] ?? []);
      // Jam dihitung hanya bila setidaknya separuh kamera punya datanya, supaya jumlahnya tidak tampak kecil karena data kurang.
      return values.length * 2 >= members.length ? values.reduce((sum, value) => sum + value, 0) : null;
    });
    const now = live.reduce((sum, camera) => sum + (camera.person_count ?? 0), 0);
    const usual = live.length > 0 ? hourly[hour] : null;
    return [
      {
        id: place.id,
        name: place.name,
        about: place.about,
        cameras: members,
        online: live.length,
        now,
        usual,
        level: live.length === 0 ? "tidak_diketahui" : levelOf(now, usual),
        provisional: (profile?.days ?? 0) < MIN_DAYS,
        hourly,
        latest: members.reduce<string | null>((max, c) => (c.latest_snapshot_at && (!max || c.latest_snapshot_at > max) ? c.latest_snapshot_at : max), null),
      },
    ];
  });
}
