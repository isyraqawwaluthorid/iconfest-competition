import { WATER } from "./status";
import { formatDateTimeWib } from "./time";
import type { WaterEvent } from "./types";

export const EVENT_KIND_LABEL: Record<WaterEvent["kind"], string> = {
  luapan_sungai: "Air naik (pompa, sungai, atau kolam)",
  genangan_jalan: "Genangan di jalan",
};

/** "45 menit", "2 jam 10 menit" */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} menit`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} jam ${rest} menit` : `${hours} jam`;
}

const CSV_HEADER = ["mulai_wib", "selesai_wib", "lokasi", "jenis", "status_puncak", "waktu_puncak_wib", "durasi_menit"];

function cell(value: string | number | null): string {
  const text = value == null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Riwayat kejadian sebagai CSV, satu baris per kejadian. */
export function eventsToCsv(events: WaterEvent[]): string {
  const rows = events.map((event) => [
    formatDateTimeWib(event.started_at),
    event.ended_at ? formatDateTimeWib(event.ended_at) : "masih berlangsung",
    event.camera_name,
    EVENT_KIND_LABEL[event.kind],
    event.peak_status ? WATER[event.peak_status].label : "",
    event.peak_at ? formatDateTimeWib(event.peak_at) : "",
    event.duration_minutes,
  ]);
  return [CSV_HEADER, ...rows].map((row) => row.map(cell).join(",")).join("\n") + "\n";
}
