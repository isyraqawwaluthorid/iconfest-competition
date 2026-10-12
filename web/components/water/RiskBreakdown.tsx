import { Badge } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/insight";
import { RISK } from "@/lib/status";
import type { CameraOverview, RiskComponents } from "@/lib/types";

const PARTS = [
  { key: "status", label: "Status air", explain: "normal 0 · waspada 0,4 · siaga 0,7 · awas 1" },
  { key: "trend", label: "Tren", explain: "naik 0,5 · naik cepat 1" },
  { key: "upstream", label: "Kondisi hulu", explain: "" },
  { key: "rain", label: "Prakiraan hujan 3 jam", explain: "0 mm → 0 · 20 mm atau lebih → 1" },
] as const;

/** Lokasi hulu disebut namanya; lokasi tanpa hulu yang terhubung dikatakan terus terang. */
function upstreamExplain(components: RiskComponents): string {
  const name = components.inputs?.upstream_name;
  if (!name) return "lokasi ini belum punya lokasi hulu yang terhubung, jadi komponen ini 0";
  const status = components.inputs?.upstream_status;
  return `mengikuti status ${name}${status ? ` (sekarang ${status})` : ""}: normal 0 · waspada 0,4 · siaga 0,7 · awas 1`;
}

/** Skor risiko dibuka per komponen: nilai tiap komponen, bobotnya, dan sumbangannya ke skor akhir. */
export function RiskBreakdown({ camera }: { camera: CameraOverview }) {
  const components = camera.risk_components;
  if (camera.risk_score == null || !components) {
    return (
      <p className="rounded-control bg-surface-muted p-3 text-sm text-muted">
        Skor risiko baru dihitung setelah status air lokasi ini terkonfirmasi.
      </p>
    );
  }
  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p>
          <span className="font-display text-3xl font-bold tabular-nums">{formatNumber(camera.risk_score, 2)}</span>
          <span className="ml-1.5 text-muted">dari 1</span>
        </p>
        {camera.risk_level ? <Badge status={RISK[camera.risk_level]} /> : null}
      </div>
      <ul className="space-y-3">
        {PARTS.map((part) => {
          const value = components[part.key] ?? 0;
          const weight = components.weights?.[part.key] ?? 0;
          return (
            <li key={part.key}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium">{part.label}</span>
                <span className="text-xs text-muted tabular-nums">
                  {formatNumber(value, 2)} × bobot {Math.round(weight * 100)}% = {formatNumber(value * weight, 2)}
                </span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-muted" aria-hidden>
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }} />
              </div>
              <p className="mt-0.5 text-xs text-muted">{part.key === "upstream" ? upstreamExplain(components) : part.explain}</p>
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Skor adalah jumlah keempat sumbangan di atas. Ini ukuran kewaspadaan, bukan prakiraan banjir dan bukan
        pengukuran tinggi air.
      </p>
    </div>
  );
}
