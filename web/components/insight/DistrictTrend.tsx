"use client";

import { useEffect, useState } from "react";
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatNumber } from "@/lib/insight";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import { getTrafficTrend, type TrafficHour } from "@/lib/trend";
import type { GridWeather } from "@/lib/types";

const tooltipStyle = { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", fontSize: 12 };
const hourLabel = (iso: string) => formatTimeWib(iso).replace(" WIB", "");

/** Irama lalu lintas 24 jam terakhir di satu kecamatan: rata-rata kendaraan terdeteksi per gambar, per jam. */
export function TrafficTrend({ cameraIds }: { cameraIds: string[] }) {
  const key = cameraIds.join(",");
  const [state, setState] = useState<{ key: string; data?: TrafficHour[]; error?: string }>({ key });

  useEffect(() => {
    let cancelled = false;
    getTrafficTrend(key ? key.split(",") : []).then(
      (data) => !cancelled && setState({ key, data }),
      (cause: unknown) => !cancelled && setState({ key, error: cause instanceof Error ? cause.message : "Gagal memuat tren" }),
    );
    return () => {
      cancelled = true;
    };
  }, [key]);

  if (state.key !== key || (!state.data && !state.error)) return <Skeleton className="h-28 w-full" />;
  if (state.error) return <p className="rounded-control bg-surface-muted p-3 text-xs text-muted">Tren 24 jam tidak dapat dimuat. {state.error}</p>;
  const data = state.data ?? [];
  const covered = data.filter((point) => point.vehicles != null).length;
  if (covered < 2) {
    return <p className="rounded-control bg-surface-muted p-3 text-xs text-muted">Belum cukup pembacaan untuk menggambar tren 24 jam.</p>;
  }
  return (
    <figure>
      <div className="h-28 w-full text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="hour" tickFormatter={hourLabel} minTickGap={36} stroke="var(--muted)" tickLine={false} />
            <YAxis allowDecimals={false} stroke="var(--muted)" tickLine={false} axisLine={false} width={48} />
            <Tooltip
              labelFormatter={(value) => `${formatDateTimeWib(String(value))}, satu jam`}
              formatter={(value) => [formatNumber(Number(value), 1), "Kendaraan per gambar"]}
              contentStyle={tooltipStyle}
            />
            {/* Jam tanpa pembacaan dibiarkan terputus, supaya jeda data tidak tersamar sebagai jalan sepi. */}
            <Area type="monotone" dataKey="vehicles" stroke="var(--primary)" fill="var(--primary-soft)" strokeWidth={2} connectNulls={false} isAnimationActive={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-muted">
        Rata-rata kendaraan terdeteksi per gambar, per jam, 24 jam terakhir.
        {covered < data.length ? ` Garis terputus pada ${data.length - covered} jam tanpa data.` : ""}
      </figcaption>
    </figure>
  );
}

/** Prakiraan hujan per jam untuk jam-jam ke depan, dari titik cuaca terdekat. */
export function RainOutlook({ rain }: { rain: GridWeather }) {
  const data = rain.hourly.map((slot) => ({ hour: new Date(slot.time * 1000).toISOString(), mm: slot.precipitation, probability: slot.probability }));
  if (data.length === 0) return null;
  return (
    <figure className="mt-3">
      <div className="h-20 w-full text-[10px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 6, right: 4, bottom: 0, left: -28 }}>
            <XAxis dataKey="hour" tickFormatter={hourLabel} minTickGap={28} stroke="var(--muted)" tickLine={false} />
            {/* Sumbu minimal 5 mm: gerimis tidak digambar setinggi hujan lebat. */}
            <YAxis domain={[0, (max: number) => Math.max(5, Math.ceil(max))]} allowDecimals={false} stroke="var(--muted)" tickLine={false} axisLine={false} width={48} />
            <Tooltip
              labelFormatter={(value) => `Sampai ${formatDateTimeWib(String(value))}`}
              formatter={(value, _name, item) => [
                `${formatNumber(Number(value), 1)} mm${item.payload.probability != null ? ` · peluang ${item.payload.probability}%` : ""}`,
                "Hujan",
              ]}
              contentStyle={tooltipStyle}
            />
            <Bar dataKey="mm" fill="var(--rain-2)" radius={[2, 2, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="mt-1 text-xs text-muted">Prakiraan hujan per jam, {data.length} jam ke depan (mm).</figcaption>
    </figure>
  );
}
