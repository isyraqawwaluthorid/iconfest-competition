import { isElevated } from "./status";
import type { CameraOverview, SiteReading, WaterStatus } from "./types";

/**
 * Perkembangan lokasi air yang sedang bergerak: penilaian AI satu per satu, dan kapan status resminya berubah.
 * Aturannya tidak diulang di sini; `level`, `previous`, dan `confirmed` dicatat worker di tiap penilaian.
 */

export const PROGRESS_WINDOW_MINUTES = 120;
const RANK: Partial<Record<WaterStatus, number>> = { normal: 0, waspada: 1, siaga: 2, awas: 3 };

export type StatusSpan = { from: number; to: number; status: WaterStatus | null };

export type SiteProgress = {
  camera: CameraOverview;
  readings: SiteReading[];
  /** Level yang baru dinilai AI di atas status resmi dan sudah dihitung aturan, tetapi belum dikonfirmasi penilaian berikutnya. */
  pending: WaterStatus | null;
  /** Penilaian AI paling baru dalam jendela waktu: buktinya (keyakinan, alasan, gambar) ditampilkan apa adanya. */
  latest: SiteReading | null;
  /** Status resmi sepanjang jendela waktu, untuk digambar sebagai pita. */
  spans: StatusSpan[];
};

function rank(status: WaterStatus | null | undefined): number {
  return RANK[status ?? "normal"] ?? 0;
}

/** Penilaian terakhir yang dihitung aturan dan lebih tinggi daripada status resmi sekarang. */
export function pendingLevel(camera: CameraOverview, readings: SiteReading[]): WaterStatus | null {
  const latest = readings.at(-1);
  return latest?.level && rank(latest.level) > rank(camera.water_status) ? latest.level : null;
}

function statusSpans(camera: CameraOverview, readings: SiteReading[], start: number): StatusSpan[] {
  const marks = readings.filter((reading) => reading.confirmed !== undefined);
  if (marks.length === 0) return [{ from: start, to: Infinity, status: camera.water_status }];
  const spans: StatusSpan[] = [];
  let from = start;
  let status: WaterStatus | null = marks[0].previous ?? null;
  for (const mark of marks) {
    const at = new Date(mark.captured_at).getTime();
    if ((mark.confirmed ?? null) !== status) {
      spans.push({ from, to: at, status });
      [from, status] = [at, mark.confirmed ?? null];
    }
  }
  // Rentang terakhir dibuka sampai setelah "sekarang" (`Infinity`), supaya status terbaru punya lebar di linimasa.
  return [...spans, { from, to: Infinity, status }];
}

/**
 * Lokasi yang layak ditampilkan di linimasa: statusnya di atas normal, baru berubah, sedang menunggu
 * konfirmasi, atau perlu diperiksa. Pada hari yang tenang hasilnya kosong dan linimasa tidak tampil.
 */
export function siteProgress(cameras: CameraOverview[], readings: SiteReading[], now: number): SiteProgress[] {
  const start = now - PROGRESS_WINDOW_MINUTES * 60_000;
  const bySite = new Map<string, SiteReading[]>();
  for (const reading of readings) {
    const at = new Date(reading.captured_at).getTime();
    if (at >= start && at <= now) bySite.set(reading.camera_id, [...(bySite.get(reading.camera_id) ?? []), reading]);
  }
  return cameras
    .flatMap((camera): SiteProgress[] => {
      const own = bySite.get(camera.id) ?? [];
      const pending = pendingLevel(camera, own);
      const changed = camera.water_status_since != null && new Date(camera.water_status_since).getTime() >= start;
      const doubtful = Boolean(camera.needs_verification) && own.at(-1)?.status !== "normal" && own.length > 0;
      if (!isElevated(camera.water_status) && !pending && !changed && !doubtful) return [];
      return [{ camera, readings: own, pending, latest: own.at(-1) ?? null, spans: statusSpans(camera, own, start) }];
    })
    .sort(
      (a, b) =>
        Math.max(rank(b.camera.water_status), rank(b.pending)) - Math.max(rank(a.camera.water_status), rank(a.pending)) ||
        a.camera.name.localeCompare(b.camera.name),
    );
}
