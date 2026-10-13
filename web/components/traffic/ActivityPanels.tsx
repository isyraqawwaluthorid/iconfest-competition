"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import {
  ACTIVITY_LEVELS,
  ACTIVITY_METRICS,
  activityLevel,
  cityHourly,
  hexTitle,
  hourRange,
  HOURS,
  peakHour,
  type ActivityMetric,
  type ActivityProfile,
  type Hex,
} from "@/lib/activity";
import { formatNumber } from "@/lib/insight";
import { formatDateTimeWib } from "@/lib/time";
import { PANEL_BOTTOM, PANEL_LEFT, PANEL_RIGHT } from "./layout";

const TOP_COUNT = 6;
const PLAY_STEP_MS = 900;
const LEVELS = Array.from({ length: ACTIVITY_LEVELS }, (_, i) => i + 1);

type Props = {
  profile: ActivityProfile | null;
  hexes: Hex[];
  breaks: number[];
  hour: number;
  /** Jam sekarang di Semarang; `null` sampai halaman terpasang di browser. */
  currentHour: number | null;
  metric: ActivityMetric;
  selected: string | null;
  onHour: (hour: number) => void;
  /** Maju satu jam; dipanggil berkala selama tombol Putar aktif. */
  onAdvance: () => void;
  onMetric: (metric: ActivityMetric) => void;
  onSelect: (hexId: string | null) => void;
};

/**
 * Panel lapisan "Aktivitas per jam". Kiri: bentuk satu hari untuk semua kawasan terpantau. Bawah: penggeser
 * jam. Kanan: kawasan teramai pada jam itu, atau rincian heksagon yang dipilih.
 */
export function ActivityPanels({ profile, hexes, breaks, hour, currentHour, metric, selected, onHour, onAdvance, onMetric, onSelect }: Props) {
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(onAdvance, PLAY_STEP_MS);
    return () => clearInterval(timer);
  }, [playing, onAdvance]);

  if (!profile || hexes.length === 0) {
    return (
      <div className={PANEL_LEFT}>
        <section className="map-panel relative p-4">
          <p className="label-caps text-muted">Aktivitas per jam</p>
          <h1 className="mt-1 text-xl leading-tight font-extrabold">Profil aktivitas belum tersedia</h1>
          <p className="mt-1.5 text-sm text-muted">
            Sistem menghitungnya tiap jam dari hitungan kendaraan dan orang pada gambar kamera. Jika sistem baru
            dinyalakan, lapisan ini terisi dalam beberapa menit.
          </p>
        </section>
      </div>
    );
  }

  const unit = ACTIVITY_METRICS.find((item) => item.id === metric)?.unit ?? "";
  const city = cityHourly(hexes);
  const cityMax = Math.max(...city.map((value) => value ?? 0), 1);
  const peak = peakHour(city);
  const selectedHex = hexes.find((hex) => hex.id === selected) ?? null;
  const busiest = hexes
    .filter((hex) => hex.hourly[hour] !== null)
    .sort((a, b) => (b.hourly[hour] ?? 0) - (a.hourly[hour] ?? 0))
    .slice(0, TOP_COUNT);

  return (
    <>
      <div className={PANEL_BOTTOM}>
        <div className="map-panel relative px-3 py-2.5">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setPlaying((on) => !on)}
              aria-pressed={playing}
              className="shrink-0 rounded-control bg-primary px-3 py-1.5 text-xs font-semibold text-on-primary"
            >
              {playing ? "Jeda" : "Putar"}
            </button>
            <label className="flex min-w-0 flex-1 items-center gap-3 text-sm">
              <span className="shrink-0 font-display font-bold tabular-nums">Pukul {hourRange(hour)}</span>
              <input
                type="range"
                min={0}
                max={23}
                step={1}
                value={hour}
                onChange={(event) => {
                  setPlaying(false);
                  onHour(Number(event.target.value));
                }}
                aria-label="Jam yang ditampilkan"
                className="min-w-40 flex-1 accent-primary"
              />
            </label>
            {currentHour !== null && currentHour !== hour ? (
              <button
                type="button"
                onClick={() => {
                  setPlaying(false);
                  onHour(currentHour);
                }}
                className="shrink-0 rounded-control border border-border px-2.5 py-1.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
              >
                Jam sekarang
              </button>
            ) : null}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-muted">
            <span className="flex items-center gap-1.5">
              Lebih sepi
              <span className="flex overflow-hidden rounded-[3px] border border-border" aria-hidden>
                {LEVELS.map((level) => (
                  <span key={level} className={`activity-swatch level-${level} h-3 w-5`} />
                ))}
              </span>
              Lebih ramai
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="activity-swatch level-0 h-3 w-5 rounded-[3px]" />
              Belum ada data pada jam ini
            </span>
            <span className="flex items-center gap-1.5">
              <span aria-hidden className="activity-swatch level-none h-3 w-5 rounded-[3px]" />
              Tanpa kamera
            </span>
          </div>
        </div>
      </div>

      <div className={PANEL_LEFT}>
        <section aria-label="Aktivitas biasanya" className="map-panel relative p-4">
          <p className="label-caps text-muted">Aktivitas biasanya</p>
          <h1 className="mt-1 text-xl leading-tight font-extrabold">
            {peak === null ? "Belum cukup data untuk melihat jam teramai" : `Paling ramai sekitar pukul ${hourRange(peak)}`}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            Rata-rata {unit}, di {hexes.length} kawasan yang punya kamera. Ketuk satu batang untuk melihat jam itu di peta.
          </p>

          <HourBars values={city} max={cityMax} hour={hour} onHour={onHour} label="Aktivitas kawasan terpantau per jam" />

          <div role="group" aria-label="Yang dihitung" className="mt-3 flex gap-1 rounded-control bg-surface-muted p-1">
            {ACTIVITY_METRICS.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={item.id === metric}
                onClick={() => onMetric(item.id)}
                className={`flex-1 rounded-control px-2 py-1 text-xs transition-colors ${
                  item.id === metric ? "bg-surface font-semibold text-text shadow-card" : "font-medium text-muted hover:text-text"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {metric === "persons" ? (
            <p className="mt-2 text-xs text-muted">
              Yang dihitung pejalan kaki; orang yang terdeteksi sedang menaiki sepeda motor tidak ikut. Pengendara yang motornya
              tidak terdeteksi masih bisa terhitung.
            </p>
          ) : null}

          <div className="mt-3 space-y-1 border-t border-border pt-3 text-xs text-muted">
            <p>
              Dari {profile.days} hari data{profile.since ? ` (sejak ${formatDateTimeWib(profile.since)})` : ""}. Makin banyak hari
              terkumpul, makin mewakili pola ini.
            </p>
            <p>Heksagon abu-abu adalah kawasan tanpa kamera; tidak diisi perkiraan. Ini bukan jumlah kendaraan yang lewat.</p>
          </div>
        </section>
      </div>

      <div className={PANEL_RIGHT}>
        <aside className="map-panel relative flex flex-col overflow-hidden lg:max-h-full">
          <div className="overflow-y-auto p-4 text-sm">
            {selectedHex ? (
              <HexDetail hex={selectedHex} hour={hour} unit={unit} breaks={breaks} onHour={onHour} onClose={() => onSelect(null)} />
            ) : (
              <>
                <p className="label-caps text-muted">Kawasan teramai pukul {hourRange(hour)}</p>
                {busiest.length === 0 ? (
                  <p className="mt-3 text-muted">Belum ada data untuk jam ini. Pilih jam lain pada penggeser.</p>
                ) : (
                  <ol className="mt-1 divide-y divide-border">
                    {busiest.map((hex, index) => (
                      <li key={hex.id}>
                        <button type="button" onClick={() => onSelect(hex.id)} className="flex w-full items-center gap-2.5 py-2.5 text-left hover:text-primary">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-muted text-xs font-bold text-muted tabular-nums">
                            {index + 1}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-semibold">{hexTitle(hex)}</span>
                            <span className="block truncate text-xs text-muted">{hex.district ?? "Di luar batas kota"}</span>
                          </span>
                          <span className="shrink-0 text-right">
                            <span className="block font-display text-lg leading-none font-bold tabular-nums">
                              {formatNumber(hex.hourly[hour] ?? 0, 1)}
                            </span>
                            <span className="block text-[11px] text-muted">per gambar</span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="mt-3 rounded-control border border-dashed border-border p-3 text-xs text-muted">
                  Pilih satu heksagon di peta atau di daftar untuk melihat pola 24 jamnya dan kamera yang menjadi sumbernya.
                </p>
              </>
            )}
          </div>
        </aside>
      </div>
    </>
  );
}

type HourBarsProps = {
  values: (number | null)[];
  max: number;
  hour: number;
  /** Dipanggil saat satu batang diketuk; tanpa ini batang hanya untuk dibaca. */
  onHour?: (hour: number) => void;
  label: string;
};

/** Dua puluh empat batang, satu per jam. Jam tanpa data digambar sebagai garis putus, bukan batang nol. */
export function HourBars({ values, max, hour, onHour, label }: HourBarsProps) {
  return (
    <div className="mt-3">
      <div className="flex h-20 items-end gap-px" role="group" aria-label={label}>
        {HOURS.map((item) => {
          const value = values[item];
          return (
            <button
              key={item}
              type="button"
              onClick={onHour ? () => onHour(item) : undefined}
              disabled={!onHour}
              title={`Pukul ${hourRange(item)}: ${value === null ? "belum ada data" : formatNumber(value, 1)}`}
              aria-label={`Pukul ${hourRange(item)}`}
              aria-pressed={item === hour}
              className="group flex h-full flex-1 items-end"
            >
              <span
                className={`hour-bar w-full rounded-t-[2px] ${value === null ? "is-empty" : ""} ${item === hour ? "is-current" : ""}`}
                style={{ height: value === null ? "100%" : `${Math.max(4, (value / max) * 100)}%` }}
              />
            </button>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[10px] text-muted tabular-nums" aria-hidden>
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
    </div>
  );
}

type HexDetailProps = { hex: Hex; hour: number; unit: string; breaks: number[]; onHour: (hour: number) => void; onClose: () => void };

/** Rincian satu heksagon: nilainya pada jam terpilih, pola 24 jamnya, dan kamera yang menjadi sumbernya. */
function HexDetail({ hex, hour, unit, breaks, onHour, onClose }: HexDetailProps) {
  const value = hex.hourly[hour];
  const peak = peakHour(hex.hourly);
  const max = Math.max(...hex.hourly.map((item) => item ?? 0), 1);
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="label-caps text-muted">Kawasan · {hex.district ?? "di luar batas kota"}</p>
          <h2 className="mt-1 text-xl leading-tight font-extrabold">{hexTitle(hex)}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Tutup rincian kawasan"
          className="shrink-0 rounded-control border border-border p-1.5 text-muted hover:border-primary hover:text-primary"
        >
          <Icon name="close" size={16} />
        </button>
      </div>

      <div className={`activity-card level-${activityLevel(value, breaks)} rounded-control p-3`}>
        <p className="text-xs font-semibold">Pukul {hourRange(hour)}</p>
        {value === null ? (
          <p className="mt-1">Belum ada data untuk jam ini di kawasan ini.</p>
        ) : (
          <p className="mt-1">
            <span className="font-display text-2xl font-bold tabular-nums">{formatNumber(value, 1)}</span> {unit}, rata-rata dari{" "}
            {hex.cameras.length} kamera.
          </p>
        )}
        {peak !== null ? <p className="mt-1 text-xs">Kawasan ini biasanya paling ramai pukul {hourRange(peak)}.</p> : null}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted">Pola 24 jam kawasan ini</p>
        <HourBars values={hex.hourly} max={max} hour={hour} onHour={onHour} label="Aktivitas kawasan ini per jam" />
      </div>

      <div>
        <p className="mb-1 text-xs font-semibold text-muted">Kamera sumber</p>
        <ul className="divide-y divide-border">
          {hex.cameras.map((camera) => (
            <li key={camera.id} className="py-2">
              <Link href={`/kamera/${camera.id}`} className="font-semibold underline-offset-2 hover:text-primary hover:underline">
                {camera.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
