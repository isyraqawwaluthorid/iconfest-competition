import type { Tone } from "@/lib/status";
import type { ReferenceLine } from "@/lib/types";

type Props = {
  src: string;
  alt: string;
  /** Keterangan di pojok kiri atas gambar, misalnya "Saat ini · 14.30 WIB". */
  label: string;
  tone?: Tone;
  lines?: ReferenceLine[];
  caption?: string;
};

/** Garis acuan kalibrasi di atas gambar; koordinatnya 0..1 terhadap lebar dan tinggi gambar. */
export function LineOverlay({ lines }: { lines: ReferenceLine[] }) {
  if (lines.length === 0) return null;
  return (
    <svg viewBox="0 0 1 1" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
      {lines.map((line) => (
        <g key={line.level} className={`level-${line.level}`}>
          <line
            x1={line.points[0][0]} y1={line.points[0][1]} x2={line.points[1][0]} y2={line.points[1][1]}
            className="calib-line" vectorEffect="non-scaling-stroke"
          />
        </g>
      ))}
    </svg>
  );
}

/** Satu gambar bukti berbingkai, dengan keterangan waktu atau peran gambar di pojoknya. */
export function EvidenceFrame({ src, alt, label, tone = "unknown", lines = [], caption }: Props) {
  return (
    <figure>
      <div className="relative overflow-hidden rounded-token border border-border bg-surface-muted">
        {/* Gambar dari Storage sudah berukuran web; next/image hanya akan menambah beban optimasi. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" className="block w-full" />
        <LineOverlay lines={lines} />
        <span className={`tint tone-${tone} absolute top-2 left-2 rounded-control px-2 py-1 text-[11px] font-bold tracking-wide uppercase shadow-float`}>
          {label}
        </span>
      </div>
      {caption ? <figcaption className="mt-1.5 text-xs text-muted">{caption}</figcaption> : null}
    </figure>
  );
}
