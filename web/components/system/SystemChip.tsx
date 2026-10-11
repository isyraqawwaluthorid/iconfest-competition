"use client";

import { useNow, useWorkerHeartbeat } from "@/lib/hooks";
import { formatDateTimeWib, minutesSince, timeAgo } from "@/lib/time";
import type { WorkerHeartbeat } from "@/lib/types";

const STALE_AFTER_MINUTES = 15;

/** Penanda kecil di header: sistem pemantau aktif atau tidak, dan kapan data terakhir masuk. */
export function SystemChip({ initial }: { initial: WorkerHeartbeat | null }) {
  const heartbeat = useWorkerHeartbeat(initial);
  const now = useNow();
  if (now === null) return null;

  const active = heartbeat !== null && minutesSince(heartbeat.last_seen, now) <= STALE_AFTER_MINUTES;
  const text = !heartbeat
    ? "Sistem belum mengirim data"
    : active
      ? `Sistem aktif · diperbarui ${timeAgo(heartbeat.last_seen, now)}`
      : `Data tertunda · terakhir ${formatDateTimeWib(heartbeat.last_seen)}`;
  return (
    <span
      role="status"
      className={`tint ${active ? "tone-normal" : "tone-waspada"} inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium`}
    >
      <span aria-hidden className={`tint-dot h-2 w-2 rounded-full ${active ? "animate-pulse" : ""}`} />
      {text}
    </span>
  );
}
