import type { StatusDisplay } from "@/lib/status";

/** Status selalu tampil sebagai titik warna + teks, tidak pernah warna saja. */
export function Badge({ status }: { status: StatusDisplay }) {
  return (
    <span
      className={`tint tone-${status.tone} inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] leading-none font-bold tracking-wide whitespace-nowrap uppercase`}
    >
      <span aria-hidden className="tint-dot h-2 w-2 rounded-full" />
      {status.label}
    </span>
  );
}
