import Link from "next/link";
import { PROGRESS_WINDOW_MINUTES, type SiteProgress } from "@/lib/progress";
import { isElevated, WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";
import type { SiteReading, WaterStatus } from "@/lib/types";

const MAX_ROWS = 4;
const NOW_AT = 92; // posisi "sekarang" pada linimasa, dalam persen lebar
const tone = (status: WaterStatus | null | undefined) => (status ? WATER[status].tone : "unknown");
const clock = (at: number | string) => formatTimeWib(new Date(at).toISOString()).replace(" WIB", "");

/** Kalimat keadaan satu lokasi: menunggu konfirmasi, status sekarang, atau perlu diperiksa. */
function stateOf({ camera, pending }: SiteProgress): string {
  if (pending) return `AI menilai ${WATER[pending].label.toLowerCase()} sekali · menunggu penilaian kedua`;
  const since = camera.water_status_since ? ` sejak ${clock(camera.water_status_since)}` : "";
  if (isElevated(camera.water_status)) return `${WATER[camera.water_status ?? "normal"].label}${since}`;
  return camera.needs_verification ? "Penilaian terakhir kurang yakin · perlu diperiksa" : `Kembali normal${since}`;
}

function dotTitle(reading: SiteReading): string {
  const confidence = reading.confidence != null ? `, keyakinan ${reading.confidence.toFixed(2).replace(".", ",")}` : "";
  const counted = reading.level === undefined ? "" : reading.level === null ? " · tidak dihitung" : " · dihitung";
  return `${clock(reading.captured_at)} AI menilai ${WATER[reading.status].label.toLowerCase()}${confidence}${counted}`;
}

/**
 * Linimasa lokasi air yang sedang bergerak. Tiap titik adalah satu penilaian AI (penuh = dihitung aturan,
 * kosong = tidak dihitung); pita di bawahnya adalah status resmi. Dengan begitu terlihat kapan AI mulai
 * menilai naik dan kapan status resmi benar-benar berubah. Tidak tampil saat tidak ada yang bergerak.
 */
export function ProgressTimeline({ rows, now }: { rows: SiteProgress[]; now: number }) {
  if (rows.length === 0) return null;
  const start = now - PROGRESS_WINDOW_MINUTES * 60_000;
  // "Sekarang" tidak ditaruh di tepi kanan: sisa ruangnya memperlihatkan warna status yang baru saja berubah.
  const position = (at: number) => (at >= now ? "100%" : `${Math.max(0, ((at - start) / (now - start)) * NOW_AT)}%`);
  const dot = (at: number) => `${Math.min(NOW_AT, Math.max(0, ((at - start) / (now - start)) * NOW_AT))}%`;
  return (
    <section aria-label="Perkembangan lokasi air" className="map-panel relative mt-3 p-4 text-sm">
      <p className="label-caps">Perkembangan 2 jam terakhir</p>
      <ul className="mt-3 space-y-3.5">
        {rows.slice(0, MAX_ROWS).map((row) => (
          <li key={row.camera.id}>
            <div className="flex items-baseline justify-between gap-2">
              <Link href={`/kamera/${row.camera.id}`} className="truncate font-semibold underline-offset-2 hover:underline">
                {row.camera.name}
              </Link>
            </div>
            <p className="text-xs text-muted">{stateOf(row)}</p>
            <div className="relative mt-1.5 h-5" role="img" aria-label={`Linimasa ${row.camera.name}: ${stateOf(row)}`}>
              {row.spans.map((span) => (
                <span
                  key={span.from}
                  className={`status-band accent tone-${tone(span.status)} absolute bottom-0 h-1.5`}
                  style={{ left: position(span.from), right: `calc(100% - ${position(span.to)})` }}
                />
              ))}
              {row.readings.map((reading) => (
                <span
                  key={reading.captured_at}
                  title={dotTitle(reading)}
                  className={`reading-dot accent tone-${tone(reading.level ?? reading.status)} absolute top-0 h-3 w-3 -translate-x-1/2 rounded-full ${reading.level ? "is-counted" : ""}`}
                  style={{ left: dot(new Date(reading.captured_at).getTime()) }}
                />
              ))}
            </div>
          </li>
        ))}
      </ul>
      <div className="relative mt-1.5 h-3 text-[10px] text-muted tabular-nums">
        <span className="absolute left-0">{clock(start)}</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${NOW_AT}%` }}>
          {clock(now)}
        </span>
      </div>
      {rows.length > MAX_ROWS ? <p className="mt-1 text-xs text-muted">dan {rows.length - MAX_ROWS} lokasi lain</p> : null}
      <p className="mt-2 border-t border-border pt-2 text-[11px] leading-snug text-muted">
        Titik = satu penilaian AI; titik penuh dihitung aturan, titik kosong tidak. Pita = status resmi, yang baru naik
        setelah dua penilaian sepakat.
      </p>
    </section>
  );
}
