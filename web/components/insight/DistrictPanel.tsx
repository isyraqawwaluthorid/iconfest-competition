import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import { formatNumber, themeDisplay, type DistrictSummary } from "@/lib/insight";
import { DENSITY, NOT_ASSESSED, TREND_LABEL, WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";

/** Rincian satu kecamatan: air, lalu lintas, dan hujan, dengan kamera hanya sebagai sumber data. */
export function DistrictPanel({ summary, onClose }: { summary: DistrictSummary; onClose: () => void }) {
  const { district, cameras, online, waterSites, trafficSites, densityIndex, densityLevel, busy, rain } = summary;
  const sites = [...waterSites].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
  const risk = themeDisplay(summary, "risk");
  return (
    <div className="space-y-5 text-sm">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="label-caps text-primary">Kecamatan terpilih</p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup rincian kecamatan"
            className="rounded-control p-1 text-muted hover:bg-surface-muted hover:text-text"
          >
            <Icon name="close" size={18} />
          </button>
        </div>
        <h2 className="mt-1 text-2xl font-bold">{district.name}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge status={risk} />
          <span className="text-xs text-muted">
            {cameras.length === 0 ? "Tidak ada kamera publik di sini" : `${cameras.length} kamera sumber data, ${online} aktif`}
          </span>
        </div>
      </div>

      <section className="space-y-2">
        <h3 className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name="droplet" size={14} /> Air
        </h3>
        {sites.length === 0 ? (
          <p className="rounded-control bg-surface-muted p-3 text-muted">
            Belum ada lokasi air yang dipantau di sini, jadi kondisi airnya tidak diketahui.
          </p>
        ) : (
          <ul className="space-y-2">
            {sites.map((site) => {
              const status = site.water_status ? WATER[site.water_status] : NOT_ASSESSED;
              return (
                <li key={site.id} className={`tint tone-${status.tone} accent-left rounded-control p-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/kamera/${site.id}`} className="font-semibold underline-offset-2 hover:underline">
                      {site.name}
                    </Link>
                    <span className="text-xs font-bold uppercase">{status.label}</span>
                  </div>
                  <p className="mt-1 text-xs">
                    {site.water_trend ? `Tren ${TREND_LABEL[site.water_trend]}` : "Tren belum diketahui"}
                    {site.risk_score != null ? ` · skor risiko ${formatNumber(site.risk_score, 2)}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name="car" size={14} /> Lalu lintas
        </h3>
        {densityIndex == null ? (
          <p className="rounded-control bg-surface-muted p-3 text-muted">
            Tidak ada kamera lalu lintas aktif yang punya pembanding di sini.
          </p>
        ) : (
          <div className="rounded-control border border-border p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p>
                <span className="font-display text-2xl font-bold tabular-nums">{formatNumber(densityIndex, 2)}×</span>{" "}
                <span className="text-muted">kebiasaan</span>
              </p>
              <Badge status={DENSITY[densityLevel]} />
            </div>
            <p className="mt-1 text-xs text-muted">
              Median {trafficSites.length} titik; {busy} ramai atau padat. Indeks relatif, bukan hitungan kendaraan presisi.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-2">
        <h3 className="label-caps flex items-center gap-1.5 text-muted">
          <Icon name="rain" size={14} /> Hujan
        </h3>
        {rain ? (
          <div className="rounded-control border border-border p-3">
            <dl className="grid grid-cols-4 gap-2 tabular-nums">
              {(
                [
                  ["Kini", rain.precip_now_mm],
                  ["1 jam", rain.precip_next_1h_mm],
                  ["3 jam", rain.precip_next_3h_mm],
                  ["6 jam", rain.precip_next_6h_mm],
                ] as const
              ).map(([label, mm]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-display text-lg font-bold">
                    {formatNumber(mm, 1)}
                    <span className="ml-0.5 text-xs font-normal text-muted">mm</span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-xs text-muted">
              Prakiraan Open-Meteo, titik {rain.name}, diambil {formatTimeWib(rain.fetched_at)}
              {rain.precip_prob_max_3h != null ? `. Peluang hujan hingga ${rain.precip_prob_max_3h}%` : ""}.
            </p>
          </div>
        ) : (
          <p className="rounded-control bg-surface-muted p-3 text-muted">Data hujan belum tersedia.</p>
        )}
      </section>
    </div>
  );
}
