"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyState } from "@/components/ui/EmptyState";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import type { TrafficPoint } from "@/lib/types";

type Metric = "vehicle_total" | "persons";

const METRIC_LABEL: Record<Metric, string> = { vehicle_total: "Kendaraan terdeteksi", persons: "Orang terdeteksi" };

/** Hitungan per siklus 24 jam terakhir, dengan garis pembanding (median baseline kamera itu sendiri). */
export function DensityChart({ points, metric }: { points: TrafficPoint[]; metric: Metric }) {
  if (points.length < 2) {
    return (
      <EmptyState
        title="Grafik belum tersedia"
        reason="Butuh setidaknya dua pembacaan. Kamera ini baru mulai dihitung atau sedang offline."
      />
    );
  }
  const data = points.map((p) => ({ at: p.captured_at, value: p[metric], baseline: p.baseline_median }));

  return (
    <div className="h-64 w-full text-xs">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis dataKey="at" tickFormatter={(v: string) => formatTimeWib(v).replace(" WIB", "")} minTickGap={48} stroke="var(--muted)" />
          <YAxis allowDecimals={false} stroke="var(--muted)" />
          <Tooltip
            labelFormatter={(v) => formatDateTimeWib(String(v))}
            contentStyle={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius)" }}
          />
          <Line type="monotone" dataKey="value" name={METRIC_LABEL[metric]} stroke="var(--primary)" dot={false} strokeWidth={2} isAnimationActive={false} />
          <Line type="stepAfter" dataKey="baseline" name="Pembanding (median)" stroke="var(--muted)" strokeDasharray="6 4" dot={false} connectNulls isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
