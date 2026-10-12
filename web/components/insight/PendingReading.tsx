import Link from "next/link";
import { NOT_ASSESSED, WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";
import type { SiteReading, WaterStatus } from "@/lib/types";

type Props = {
  /** Status resmi lokasi saat ini (belum berubah). */
  status: WaterStatus | null;
  /** Level yang dinilai AI kamera pada penilaian terakhir. */
  level: WaterStatus;
  reading: SiteReading;
  simulated: boolean;
  /** Versi ringkas untuk linimasa: tanpa alasan, penjelasan, dan tautan bukti. */
  compact?: boolean;
};

const confidenceText = (value: number | null) => (value == null ? "–" : value.toFixed(2).replace(".", ","));

/**
 * Indikasi awal: AI kamera sudah sekali menilai lokasi ini naik, tetapi status resminya belum berubah.
 * Keduanya ditampilkan berdampingan supaya tidak tertukar, lengkap dengan bukti penilaiannya dan apa yang terjadi berikutnya.
 */
export function PendingReading({ status, level, reading, simulated, compact = false }: Props) {
  const needed = reading.needed ?? 2;
  const official = status ? WATER[status] : NOT_ASSESSED;
  const judged = WATER[level];
  const nextBy = reading.recheck_minutes
    ? formatTimeWib(new Date(new Date(reading.captured_at).getTime() + reading.recheck_minutes * 60_000).toISOString())
    : null;
  return (
    <div className={`tint tone-${judged.tone} mt-2 rounded-control border border-dashed border-current p-2.5 text-xs`}>
      <p className="label-caps text-[10px]">Indikasi awal · belum menjadi status resmi</p>
      <dl className="mt-1.5 grid grid-cols-2 gap-2">
        <div>
          <dt>Status resmi</dt>
          <dd className="text-sm font-bold uppercase">{official.label}</dd>
        </div>
        <div>
          <dt>AI kamera menilai</dt>
          <dd className="text-sm font-bold uppercase">{judged.label}</dd>
        </div>
      </dl>
      <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: needed }, (_, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-full border-2 border-current ${index === 0 ? "bg-current" : ""}`} />
          ))}
        </span>
        1 dari {needed} penilaian sepakat
      </p>
      <p className="mt-1">
        Dinilai {formatTimeWib(reading.captured_at)}, keyakinan {confidenceText(reading.confidence)}
        {nextBy ? `. Penilaian kedua paling lambat ${nextBy}` : ""}.
      </p>
      {compact ? null : (
        <>
          {reading.reason ? <p className="mt-1.5 italic">Alasan AI: &ldquo;{reading.reason}&rdquo;</p> : null}
          <p className="mt-1.5">
            Jika penilaian kedua juga di atas {official.label.toLowerCase()}, status resmi naik dan peringatan dibuat. Jika
            tidak, indikasi ini gugur dan status resmi tetap {official.label.toLowerCase()}.
          </p>
          <p className="mt-1.5">
            {simulated ? (
              "Penilaian ini buatan untuk simulasi, jadi tidak ada gambarnya."
            ) : (
              <Link href={`/kamera/${reading.camera_id}`} className="font-semibold underline underline-offset-2">
                Lihat gambar yang dinilai
              </Link>
            )}
          </p>
        </>
      )}
    </div>
  );
}

const MAX_HISTORY = 6;

/** Riwayat penilaian AI kamera satu lokasi, terbaru di atas: hasilnya, keyakinannya, dihitung aturan atau tidak, dan status resmi sesudahnya. */
export function ReadingHistory({ readings }: { readings: SiteReading[] }) {
  if (readings.length === 0) return null;
  const rows = [...readings].reverse().slice(0, MAX_HISTORY);
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-[11px] tabular-nums">
        <caption className="label-caps mb-1 text-left text-[10px]">Riwayat penilaian AI kamera</caption>
        <thead>
          <tr className="border-b border-current/30">
            <th className="py-1 pr-2 font-semibold">Jam</th>
            <th className="py-1 pr-2 font-semibold">AI menilai</th>
            <th className="py-1 pr-2 font-semibold">Yakin</th>
            <th className="py-1 pr-2 font-semibold">Dihitung</th>
            <th className="py-1 font-semibold">Status resmi</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((reading) => (
            <tr key={reading.captured_at} className="border-b border-current/10 last:border-0">
              <td className="py-1 pr-2">{formatTimeWib(reading.captured_at).replace(" WIB", "")}</td>
              <td className="py-1 pr-2 font-semibold">{WATER[reading.level ?? reading.status].label}</td>
              <td className="py-1 pr-2">{confidenceText(reading.confidence)}</td>
              <td className="py-1 pr-2">{reading.level === undefined ? "–" : reading.level === null ? "tidak" : "ya"}</td>
              <td className="py-1">{reading.confirmed ? WATER[reading.confirmed].label : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {readings.length > MAX_HISTORY ? <p className="mt-1 text-[10px]">{MAX_HISTORY} penilaian terakhir dari {readings.length}.</p> : null}
    </div>
  );
}
