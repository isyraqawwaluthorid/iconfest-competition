"use client";

import { useNow } from "@/lib/hooks";
import { formatDateTimeWib, timeAgo } from "@/lib/time";

/** Penanda kesegaran data: "diperbarui 3 menit lalu". */
export function FreshnessTag({ at, prefix = "Diperbarui" }: { at: string | null; prefix?: string }) {
  const now = useNow();
  if (!at) return <span className="text-xs text-muted">Belum ada data</span>;
  return (
    <time dateTime={at} title={formatDateTimeWib(at)} className="text-xs text-muted">
      {prefix} {now === null ? formatDateTimeWib(at) : timeAgo(at, now)}
    </time>
  );
}
