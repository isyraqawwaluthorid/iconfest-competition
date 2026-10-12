"use client";

import Link from "next/link";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { ROAD_REACH_M } from "@/lib/geo/roads";
import { useNow, useTrafficSeries } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import { isOnline } from "@/lib/status";
import { composition, isFewButAboveUsual, usualCount, type RoadRow } from "@/lib/traffic";
import { DensityChart } from "./DensityChart";

const COMPOSITION_WINDOW_MS = 3_600_000;

/** Rincian satu ruas: tingkatnya, angka di baliknya, gambar kamera sebagai bukti, dan perjalanannya 24 jam. */
export function SegmentPanel({ row, onClose }: { row: RoadRow; onClose: () => void }) {
  const { camera, title, status, measured } = row;
  const series = useTrafficSeries(camera.id);
  const now = useNow();
  const usual = usualCount(camera);
  const shares = series.points && now !== null ? composition(series.points, now - COMPOSITION_WINDOW_MS) : null;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-muted">Ruas jalan</p>
          <h2 className="mt-1 text-xl leading-tight font-extrabold">{title}</h2>
          <p className="mt-1 text-xs text-muted">
            Dilihat dari kamera {camera.name}. Yang diwarnai hanya potongan jalan di sekitar kamera, paling jauh ±
            {ROAD_REACH_M} m ke tiap arah, karena hanya itu yang terlihat.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup rincian ruas"
          className="shrink-0 rounded-control border border-border p-1.5 text-muted hover:border-primary hover:text-primary"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={`tint tone-${status.tone} accent-left rounded-control p-3`}>
        <Badge status={status} />
        {measured ? (
          <p className="mt-2">
            <span className="font-display text-2xl font-bold tabular-nums">{formatNumber(camera.density_index ?? 0, 1)}×</span>{" "}
            kebiasaan: {camera.vehicle_count ?? 0} kendaraan terlihat
            {usual != null ? `, biasanya sekitar ${usual} pada jam ini.` : "."}
          </p>
        ) : (
          <p className="mt-2">
            {isOnline(camera)
              ? "Kamera hidup, tetapi belum punya pembanding untuk jam ini, jadi belum bisa disebut lancar atau padat."
              : "Kamera sedang tidak mengirim gambar, jadi kondisi ruas ini sekarang tidak diketahui."}
          </p>
        )}
        {measured && isFewButAboveUsual(camera) ? (
          <p className="mt-1 text-xs">Lebih banyak dari biasanya, tetapi jumlahnya masih sedikit, jadi belum disebut ramai.</p>
        ) : null}
        {measured && camera.baseline_is_provisional ? (
          <p className="mt-1 text-xs">Pembanding masih sementara (kurang dari tiga hari data).</p>
        ) : null}
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Bukti: gambar terakhir kamera</p>
        <SnapshotView camera={camera} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Kendaraan terlihat, 24 jam terakhir</p>
        {series.error ? (
          <p className="rounded-control border border-dashed border-border p-3 text-xs text-muted">
            Riwayat ruas ini gagal dimuat. Kondisi di atas tetap berlaku; coba pilih ruas ini lagi.
          </p>
        ) : series.points ? (
          <DensityChart points={series.points} metric="vehicle_total" />
        ) : (
          <Skeleton className="h-64 w-full" />
        )}
      </div>

      {shares ? (
        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Jenis kendaraan terlihat, 1 jam terakhir</p>
          <ul className="space-y-1.5">
            {shares.map((item) => (
              <li key={item.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
                <span>{item.label}</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
                  <span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round(item.share * 100)}%` }} />
                </span>
                <span className="text-right tabular-nums">{Math.round(item.share * 100)}%</span>
              </li>
            ))}
          </ul>
          <p className="mt-1.5 text-xs text-muted">
            Dari deteksi pada gambar. Sepeda motor yang rapat atau jauh sering tidak terhitung, jadi porsinya di sini lebih
            kecil daripada di jalan.
          </p>
        </div>
      ) : null}

      <Link href={`/kamera/${camera.id}`} className="inline-block font-semibold text-primary hover:underline">
        Buka halaman kamera {camera.name}
      </Link>
    </div>
  );
}
