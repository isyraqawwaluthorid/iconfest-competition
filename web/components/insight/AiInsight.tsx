"use client";

import Link from "next/link";
import { useId, useState, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import {
  AUDIENCE_LABEL,
  INSIGHT_LEVEL,
  INSIGHT_STALE_MINUTES,
  ITEM_LEVEL,
  MODULE_DISPLAY,
  type Insight,
  type InsightItem,
} from "@/lib/ai-insight";
import { useNow } from "@/lib/hooks";
import { formatDateTimeWib, minutesSince } from "@/lib/time";

type CameraNames = Map<string, string>;

/**
 * Ringkasan dan kartu insight yang ditulis AI dari angka dan status sistem.
 * Kondisi resmi tetap yang dihitung aturan (panel kiri); bagian ini menjelaskan dan menyarankan tindakan.
 */
export function AiInsightPanel({ insight, cameraNames, clock }: { insight: Insight | null; cameraNames: CameraNames; clock?: number }) {
  const realNow = useNow();
  const now = clock ?? realNow;
  if (!insight) {
    return (
      <div className="rounded-control bg-surface-muted p-3">
        <p className="font-semibold">Ringkasan AI belum tersedia</p>
        <p className="mt-1 text-xs text-muted">
          Ringkasan ditulis otomatis setelah sistem mengumpulkan data. Kondisi kota di panel kiri dan peringatan tetap
          berlaku tanpa ringkasan ini.
        </p>
      </div>
    );
  }
  const stale = now !== null && minutesSince(insight.created_at, now) > INSIGHT_STALE_MINUTES;
  return (
    <div className="space-y-3">
      <div>
        <Badge status={INSIGHT_LEVEL[insight.overall_level]} />
        <h2 className="mt-2 text-lg leading-snug font-bold">{insight.headline}</h2>
        <p className="mt-1.5">{insight.summary}</p>
      </div>
      {stale ? (
        <p role="status" className="tint tone-waspada rounded-control p-2.5 text-xs">
          Ringkasan ini ditulis {formatDateTimeWib(insight.created_at)} dan belum diperbarui. Keadaan sekarang bisa
          berbeda; lihat kondisi kota di panel kiri.
        </p>
      ) : null}
      <ul className="space-y-2">
        {insight.items.map((item, index) => (
          <li key={`${insight.id}-${index}`}>
            {/* Saat tenang semua kartu ringkas; temuan paling penting langsung terbuka hanya jika di atas "info". */}
            <InsightCard item={item} cameraNames={cameraNames} defaultOpen={index === 0 && item.level !== "info"} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted">
        Ditulis AI ({insight.model ?? "model teks"}) dari angka dan status yang dikumpulkan sistem, {formatDateTimeWib(insight.created_at)}.
        Tingkat ditetapkan aturan, dan setiap angka diperiksa terhadap data sebelum ditampilkan.
      </p>
    </div>
  );
}

/** Satu temuan berpola Kondisi → Penyebab → Dampak → Tindakan. Kondisi selalu terlihat; sisanya dibuka saat diklik. */
export function InsightCard({ item, cameraNames, defaultOpen = false }: { item: InsightItem; cameraNames: CameraNames; defaultOpen?: boolean }) {
  const level = ITEM_LEVEL[item.level];
  const moduleDisplay = MODULE_DISPLAY[item.module];
  const sources = item.camera_ids.filter((id) => cameraNames.has(id));
  const [open, setOpen] = useState(defaultOpen);
  const detailId = useId();
  return (
    <article className={`accent tone-${level.tone} accent-left rounded-control border border-border bg-surface p-3`}>
      <div className="flex items-center justify-between gap-2">
        <span className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name={moduleDisplay.icon} size={14} /> {moduleDisplay.label}
        </span>
        <Badge status={level} />
      </div>
      <h3 className="mt-1.5 font-semibold">{item.title}</h3>
      <Step label="Kondisi">{item.body}</Step>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls={detailId}
        className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        {open ? "Sembunyikan rincian" : "Penyebab, dampak, dan tindakan"}
        <Icon name={open ? "chevron-up" : "chevron-down"} size={14} />
      </button>
      <div id={detailId} hidden={!open}>
        <Step label="Penyebab">{item.cause}</Step>
        <Step label="Dampak">{item.impact}</Step>
        {item.recommendations.length > 0 ? (
          <Step label="Tindakan">
            <ul className="space-y-1">
              {item.recommendations.map((rec, index) => (
                <li key={index}>
                  <span className="font-semibold">{AUDIENCE_LABEL[rec.audience]}:</span> {rec.action}
                </li>
              ))}
            </ul>
          </Step>
        ) : null}
        {item.evidence.length > 0 || sources.length > 0 ? (
          <div className="mt-3 border-t border-border pt-2 text-xs text-muted">
            <p className="font-semibold">Dasar data</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {item.evidence.map((fact, index) => (
                <li key={index}>{fact}</li>
              ))}
            </ul>
            {sources.length > 0 ? (
              <p className="mt-1.5">
                Lihat buktinya:{" "}
                {sources.map((id, index) => (
                  <span key={id}>
                    {index > 0 ? ", " : ""}
                    <Link href={`/kamera/${id}`} className="font-medium text-primary hover:underline">
                      {cameraNames.get(id)}
                    </Link>
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function Step({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-2">
      <p className="label-caps text-[10px] text-muted">{label}</p>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}
