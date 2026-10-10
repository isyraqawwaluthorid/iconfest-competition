import { TONE_BG, type StatusDisplay } from "@/lib/status";

/** Status selalu tampil sebagai titik warna + teks, tidak pernah warna saja. */
export function Badge({ status }: { status: StatusDisplay }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-token border border-border bg-surface px-2 py-0.5 text-xs font-medium">
      <span aria-hidden className={`h-2.5 w-2.5 rounded-full ${TONE_BG[status.tone]}`} />
      {status.label}
    </span>
  );
}
