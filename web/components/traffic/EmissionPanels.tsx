"use client";

import Link from "next/link";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { Icon } from "@/components/ui/Icon";
import { Skeleton } from "@/components/ui/Skeleton";
import { citywideShares, EMISSION_LEVELS, EMISSION_WINDOW_MINUTES, POLLUTANTS, type EmissionRow, type Pollutant } from "@/lib/emission";
import { formatNumber } from "@/lib/insight";
import { PANEL_BOTTOM, PANEL_LEFT, PANEL_RIGHT } from "./layout";

const TOP_COUNT = 8;

type Props = {
  /** `null` selama hitungan per jenis kendaraan masih dimuat. */
  rows: EmissionRow[] | null;
  error: boolean;
  pollutant: Pollutant;
  selected: string | null;
  onPollutant: (pollutant: Pollutant) => void;
  onSelect: (cameraId: string | null) => void;
};

/**
 * Panel lapisan "Beban emisi". Kiri: ruas terberat dan jenis kendaraan penyumbangnya. Kanan: peringkat ruas,
 * atau rincian ruas yang dipilih. Semua angka di sini estimasi relatif, bukan pengukuran.
 */
export function EmissionPanels({ rows, error, pollutant, selected, onPollutant, onSelect }: Props) {
  const label = POLLUTANTS.find((item) => item.id === pollutant)?.label ?? "";
  const selectedRow = rows?.find((item) => item.row.camera.id === selected) ?? null;
  const top = rows?.[0] ?? null;

  return (
    <>
      <div className={PANEL_BOTTOM}>
        <div className="map-panel relative px-3 py-2">
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1.5">
              Lebih ringan
              <span className="flex overflow-hidden rounded-[3px] border border-border" aria-hidden>
                {EMISSION_LEVELS.map((name, index) => (
                  <span key={name} className={`emission-swatch level-${index + 1} h-3 w-5`} />
                ))}
              </span>
              Lebih berat
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="h-1.5 w-5 rounded-full bg-status-unknown" />
              Tidak ada gambar
            </span>
          </div>
          <p className="mt-1 text-center text-[11px] text-muted">
            Estimasi relatif, bukan pengukuran udara dan bukan kg per jam. Garis tipis: perkiraan dari kamera terdekat.
          </p>
        </div>
      </div>

      <div className={PANEL_LEFT}>
        <section aria-label="Beban emisi relatif" className="map-panel relative p-4">
          <p className="label-caps text-muted">Beban emisi relatif · estimasi</p>
          <h1 className="mt-1 text-xl leading-tight font-extrabold">
            {error
              ? "Hitungan kendaraan gagal dimuat"
              : rows === null
                ? "Memuat hitungan kendaraan"
                : top
                  ? `Beban ${label} terberat di ${top.row.title}`
                  : "Belum ada ruas yang bisa dihitung"}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Kendaraan yang terlihat kamera dalam {EMISSION_WINDOW_MINUTES} menit terakhir, ditimbang faktor emisi resmi tiap jenis
            kendaraan.
          </p>

          <div role="group" aria-label="Polutan" className="mt-3 flex gap-1 rounded-control bg-surface-muted p-1">
            {POLLUTANTS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === pollutant}
                onClick={() => onPollutant(item.id)}
                className={`flex-1 rounded-control px-2 py-1 text-xs transition-colors ${
                  item.id === pollutant ? "bg-surface font-semibold text-text shadow-card" : "font-medium text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {rows && rows.length > 0 ? (
            <div className="mt-3">
              <p className="mb-1.5 text-xs font-semibold text-muted">Penyumbang beban {label} di semua ruas terpantau</p>
              <ShareBars shares={citywideShares(rows)} />
            </div>
          ) : null}

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
            <p>
              Yang dihitung adalah kendaraan yang terlihat pada gambar, bukan yang lewat, jadi hasilnya hanya untuk membandingkan
              ruas, tidak untuk menyebut berat emisi.
            </p>
            <p>
              Jenis kendaraan dikenali otomatis dari gambar dan bisa keliru: sepeda motor yang rapat atau jauh sering tidak
              terhitung, dan mobil besar bisa terbaca truk. Porsi tiap jenis di sini belum diuji dengan hitungan manual.
            </p>
            <p>
              Faktor emisi: Permen LH No. 12/2010.{" "}
              <Link href="/tentang" className="text-primary hover:underline">
                Batas sistem
              </Link>
            </p>
          </div>
        </section>
      </div>

      <div className={PANEL_RIGHT}>
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          <div className="overflow-y-auto p-4 text-sm">
            {selectedRow ? (
              <EmissionDetail item={selectedRow} label={label} onClose={() => onSelect(null)} />
            ) : rows === null && !error ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <p className="label-caps text-muted">Ruas dengan beban {label} terberat</p>
                {!rows || rows.length === 0 ? (
                  <p className="mt-3 text-muted">
                    {error
                      ? "Hitungan per jenis kendaraan gagal dimuat. Lapisan lain tetap bisa dipakai; coba buka lapisan ini lagi."
                      : "Belum ada gambar kamera lalu lintas dalam 30 menit terakhir."}
                  </p>
                ) : (
                  <ol className="mt-1 divide-y divide-border">
                    {rows.slice(0, TOP_COUNT).map((item, index) => (
                      <li key={item.row.camera.id}>
                        <button
                          type="button"
                          onClick={() => onSelect(item.row.camera.id)}
                          className="flex w-full items-center gap-2.5 py-2.5 text-left hover:text-primary"
                        >
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{item.row.title}</span>
                            <span className="block truncate text-xs text-muted">kamera {item.row.camera.name}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-display text-lg leading-none font-bold tabular-nums">
                              {formatNumber(item.motorEquivalent, 0)}
                            </span>
                            <span className="block text-[11px] text-muted">setara motor</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 rounded-control border border-dashed border-border p-3 text-xs text-muted">
                  &quot;Setara motor&quot;: berapa sepeda motor yang estimasi emisinya sama dengan kendaraan yang terlihat di ruas itu.
                  Satu truk setara banyak sepeda motor.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

function ShareBars({ shares }: { shares: EmissionRow["shares"] }) {
  return (
    <ul className="space-y-1.5">
      {shares.map((item) => (
        <li key={item.key} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-xs">
          <span>{item.label}</span>
          <span className="h-2 overflow-hidden rounded-full bg-surface-muted">
            <span className="emission-swatch level-4 block h-full rounded-full" style={{ width: `${Math.round(item.share * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums">{Math.round(item.share * 100)}%</span>
        </li>
      ))}
    </ul>
  );
}

/** Rincian satu ruas: tingkat bebannya dibanding ruas lain, penyumbangnya, dan gambar kamera sebagai bukti. */
function EmissionDetail({ item, label, onClose }: { item: EmissionRow; label: string; onClose: () => void }) {
  const { camera, title } = item.row;
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-muted">Ruas jalan · beban {label}</p>
          <h2 className="mt-1 text-xl leading-tight font-extrabold">{title}</h2>
          <p className="mt-1 text-xs text-muted">Dilihat dari kamera {camera.name}.</p>
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

      <div className={`emission-card level-${item.level} rounded-control p-3`}>
        <p className="text-xs font-bold tracking-wide uppercase">{EMISSION_LEVELS[item.level - 1]} dibanding ruas lain</p>
        <p className="mt-1">
          Setara <span className="font-display text-2xl font-bold tabular-nums">{formatNumber(item.motorEquivalent, 0)}</span> sepeda
          motor, rata-rata dari {item.frames} gambar terakhir.
        </p>
        <p className="mt-1 text-xs">Estimasi relatif, bukan pengukuran.</p>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Penyumbang beban {label} di ruas ini</p>
        <ShareBars shares={item.shares} />
      </div>

      <div>
        <p className="mb-1.5 text-xs font-semibold text-muted">Bukti: gambar terakhir kamera</p>
        <SnapshotView camera={camera} />
      </div>

      <Link href={`/kamera/${camera.id}`} className="inline-block font-semibold text-primary hover:underline">
        Buka halaman kamera {camera.name}
      </Link>
    </div>
  );
}
