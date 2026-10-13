import type { ActivityProfile } from "./activity";
import { isOnline, type StatusDisplay } from "./status";
import type { CameraOverview } from "./types";

/**
 * Keramaian ruang publik: beberapa kamera yang menghadap ruang pejalan kaki dikelompokkan menjadi satu tempat,
 * dan tiap tempat bisa dipecah menjadi beberapa titik (misalnya taman dan jalan di Kota Lama).
 * Yang dihitung adalah pejalan kaki yang terlihat pada gambar terakhir (worker membuang orang yang terdeteksi
 * sedang menaiki sepeda motor), dibanding rata-rata pada jam yang sama di hari-hari sebelumnya.
 * Ini bukan jumlah pengunjung, dan tidak ada pengenalan wajah.
 *
 * Hanya tempat yang kameranya sudah diperiksa menghadap ruang pejalan kaki yang didaftarkan. Kamera jalan tidak
 * dipakai: dalam antrean rapat sepeda motornya sering tidak terdeteksi, sehingga pengendaranya terhitung sebagai
 * pejalan kaki. Kamera "Titik Nol" dan "Pintu Masuk Lawang Sewu" berkategori pariwisata tetapi menghadap jalan raya.
 */
type SpotDefinition = { name: string; match: RegExp };
type PlaceDefinition = {
  id: string;
  name: string;
  about: string;
  center: [number, number];
  radiusM: number;
  /** Titik di dalam tempat ini, dikenali dari nama kamera. Kamera yang tidak cocok masuk titik "Lainnya". */
  spots?: SpotDefinition[];
};

const PLACES: PlaceDefinition[] = [
  {
    id: "kota-lama",
    name: "Kota Lama",
    about: "Kawasan wisata: Taman Srigunting, Gereja Blenduk, dan Jalan Sri Gunting.",
    center: [-6.9681, 110.4278],
    radiusM: 150,
    spots: [
      { name: "Jalan Sri Gunting", match: /SRI GUNTING/i },
      { name: "Taman Srigunting", match: /OUDETRAP/i },
      { name: "Gereja Blenduk", match: /BLENDUK/i },
    ],
  },
  {
    id: "goa-kreo",
    name: "Goa Kreo",
    about: "Kawasan wisata di tepi Waduk Jatibarang, Gunungpati.",
    center: [-7.03865, 110.35114],
    radiusM: 150,
  },
  {
    id: "balai-kota",
    name: "Balai Kota",
    about: "Halaman dan pintu masuk-keluar kantor Pemerintah Kota Semarang.",
    center: [-6.9813, 110.4126],
    radiusM: 150,
    spots: [
      { name: "Pintu masuk", match: /PINTU MASUK/i },
      { name: "Halaman", match: /HALAMAN/i },
      { name: "Pintu keluar", match: /PINTU KELUAR/i },
    ],
  },
];

const M_PER_DEG = 111_320;
const LEVEL_BOUNDS: [number, CrowdLevel][] = [
  [0.8, "sepi"],
  [1.3, "biasa"],
  [1.8, "ramai"],
];
/** Di bawah jumlah ini sebuah tempat atau titik belum disebut ramai, berapa pun kelipatannya dari biasanya. */
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

/** Keramaian sekelompok kamera: dipakai untuk satu tempat maupun satu titik di dalamnya. */
export type CrowdMeasure = {
  /** Kamera kelompok ini, yang paling banyak orangnya lebih dulu. */
  cameras: CameraOverview[];
  online: number;
  /** Pejalan kaki terlihat pada gambar terakhir semua kamera yang hidup. */
  now: number;
  /** Rata-rata pada jam ini di hari-hari sebelumnya; `null` bila jam ini belum punya data. */
  usual: number | null;
  level: CrowdLevel;
  /** Rata-rata per jam (0–23) dijumlahkan antar kamera; `null` untuk jam yang belum punya data. */
  hourly: (number | null)[];
};

export type SpotView = CrowdMeasure & { name: string };

export type PlaceView = CrowdMeasure & {
  id: string;
  name: string;
  about: string;
  center: [number, number];
  /** Titik-titik di dalam tempat ini, yang paling ramai lebih dulu; satu titik bila tempatnya tidak dipecah. */
  spots: SpotView[];
  provisional: boolean;
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

function measure(members: CameraOverview[], profile: ActivityProfile | null, hour: number): CrowdMeasure {
  const cameras = [...members].sort((a, b) => (b.person_count ?? 0) - (a.person_count ?? 0) || a.name.localeCompare(b.name));
  const live = cameras.filter(isOnline);
  const hourly = Array.from({ length: 24 }, (_, h) => {
    const values = cameras.flatMap((camera) => profile?.cameras[camera.id]?.persons[h] ?? []);
    // Jam dihitung hanya bila setidaknya separuh kamera punya datanya, supaya jumlahnya tidak tampak kecil karena data kurang.
    return values.length > 0 && values.length * 2 >= cameras.length ? values.reduce((sum, value) => sum + value, 0) : null;
  });
  const now = live.reduce((sum, camera) => sum + (camera.person_count ?? 0), 0);
  const usual = live.length > 0 ? hourly[hour] : null;
  return { cameras, online: live.length, now, usual, level: live.length === 0 ? "tidak_diketahui" : levelOf(now, usual), hourly };
}

/** Keadaan tiap tempat pada jam `hour` (WIB), yang paling ramai lebih dulu. Tempat tanpa kamera aktif tidak ikut. */
export function placeViews(cameras: CameraOverview[], profile: ActivityProfile | null, hour: number): PlaceView[] {
  const places = PLACES.flatMap((place): PlaceView[] => {
    const members = cameras.filter(
      (camera) => camera.modules.includes("crowd") && distanceM(place.center, camera.lat, camera.lng) <= place.radiusM,
    );
    if (members.length === 0) return [];
    const definitions = place.spots ?? [];
    const groups = definitions.map((spot) => ({ name: spot.name, members: members.filter((camera) => spot.match.test(camera.name)) }));
    const rest = members.filter((camera) => !definitions.some((spot) => spot.match.test(camera.name)));
    if (rest.length > 0) groups.push({ name: definitions.length > 0 ? "Lainnya" : place.name, members: rest });
    return [
      {
        ...measure(members, profile, hour),
        id: place.id,
        name: place.name,
        about: place.about,
        center: place.center,
        spots: groups
          .filter((group) => group.members.length > 0)
          .map((group) => ({ name: group.name, ...measure(group.members, profile, hour) }))
          .sort((a, b) => b.now - a.now),
        provisional: (profile?.days ?? 0) < MIN_DAYS,
        latest: members.reduce<string | null>((max, c) => (c.latest_snapshot_at && (!max || c.latest_snapshot_at > max) ? c.latest_snapshot_at : max), null),
      },
    ];
  });
  return places.sort((a, b) => b.now - a.now);
}
