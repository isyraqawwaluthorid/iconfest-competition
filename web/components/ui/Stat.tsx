import type { ReactNode } from "react";

type Props = { label: string; value: string | number; unit?: string; hint?: string; icon?: ReactNode };

/** Satu angka utama dengan label di atas dan keterangan singkat di bawah. */
export function Stat({ label, value, unit, hint, icon }: Props) {
  return (
    <div className="rounded-token border border-border bg-surface p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        <p className="label-caps text-muted">{label}</p>
        {icon ? <span className="text-primary">{icon}</span> : null}
      </div>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit ? <span className="text-sm text-muted">{unit}</span> : null}
      </p>
      {hint ? <p className="mt-1 text-sm text-muted">{hint}</p> : null}
    </div>
  );
}
