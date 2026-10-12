import Link from "next/link";
import { WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";
import type { SiteReading, WaterStatus } from "@/lib/types";

/**
 * Bukti satu penilaian AI kamera yang masih menunggu konfirmasi: apa yang dinilai, seberapa yakin, kapan,
 * alasannya, dan berapa penilaian sepakat yang masih dibutuhkan. Status resmi lokasi belum berubah.
 */
export function PendingReading({ level, reading, simulated }: { level: WaterStatus; reading: SiteReading; simulated: boolean }) {
  const needed = reading.needed ?? 2;
  const display = WATER[level];
  return (
    <div className={`tint tone-${display.tone} mt-2 rounded-control border border-dashed border-current p-2.5 text-xs`}>
      <p className="label-caps text-[10px]">Penilaian AI kamera terakhir · belum dikonfirmasi</p>
      <p className="mt-1 text-sm font-bold">
        {display.label}
        <span className="font-normal">
          {" "}
          · {formatTimeWib(reading.captured_at)}
          {reading.confidence != null ? ` · keyakinan ${reading.confidence.toFixed(2).replace(".", ",")}` : ""}
        </span>
      </p>
      {reading.reason ? <p className="mt-1 italic">&ldquo;{reading.reason}&rdquo;</p> : null}
      <p className="mt-1.5 flex items-center gap-1.5 font-semibold">
        <span aria-hidden className="flex gap-1">
          {Array.from({ length: needed }, (_, index) => (
            <span key={index} className={`h-2.5 w-2.5 rounded-full border-2 border-current ${index === 0 ? "bg-current" : ""}`} />
          ))}
        </span>
        1 dari {needed} penilaian sepakat yang dibutuhkan untuk menaikkan status
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
    </div>
  );
}
