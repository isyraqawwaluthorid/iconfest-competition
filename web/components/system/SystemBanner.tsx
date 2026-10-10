"use client";

import { useNow, useWorkerHeartbeat } from "@/lib/hooks";
import { formatDateTimeWib, minutesSince } from "@/lib/time";
import type { WorkerHeartbeat } from "@/lib/types";

const STALE_AFTER_MINUTES = 15;

/** Banner yang muncul jika worker tidak terlihat lebih dari 15 menit; halaman tetap menampilkan data terakhir. */
export function SystemBanner({ initial }: { initial: WorkerHeartbeat | null }) {
  const heartbeat = useWorkerHeartbeat(initial);
  const now = useNow();
  if (now === null) return null;

  let message: string | null = null;
  if (!heartbeat) {
    message = "Sistem pemantau belum mengirim data. Yang tampil mungkin belum lengkap.";
  } else if (minutesSince(heartbeat.last_seen, now) > STALE_AFTER_MINUTES) {
    message = `Data mungkin tidak terbaru. Terakhir diperbarui ${formatDateTimeWib(heartbeat.last_seen)}.`;
  }
  if (!message) return null;

  return (
    <div role="status" className="border-b border-status-waspada bg-surface px-4 py-2 text-center text-sm">
      <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-status-waspada" />
      {message}
    </div>
  );
}
