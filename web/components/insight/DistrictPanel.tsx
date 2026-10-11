import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { formatNumber, type DistrictSummary } from "@/lib/insight";
import { DENSITY, NOT_ASSESSED, RISK, TREND_LABEL, WATER } from "@/lib/status";
import { formatTimeWib } from "@/lib/time";

/** Rincian satu kecamatan: air, lalu lintas, dan hujan, dengan kamera hanya sebagai sumber data. */
export function DistrictPanel({ summary }: { summary: DistrictSummary }) {
  const { district, cameras, online, waterSites, trafficSites, densityIndex, densityLevel, busy, rain } = summary;
  const sites = [...waterSites].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
  return (
    <div className="space-y-4 text-sm">
      <div>
        <h2 className="text-lg font-semibold">Kecamatan {district.name}</h2>
        <p className="text-xs text-muted">
          {cameras.length === 0
            ? "Tidak ada kamera publik di kecamatan ini."
            : `${cameras.length} kamera sumber data, ${online} aktif.`}
        </p>
      </div>

      <section className="space-y-2">
        <h3 className="text-xs font-semibold text-muted">Air</h3>
        {sites.length === 0 ? (
          <p className="text-xs text-muted">Belum ada lokasi air yang dipantau di sini, jadi kondisi airnya tidak diketahui.</p>
        ) : (
          <ul className="space-y-2">
            {sites.map((site) => (
              <li key={site.id} className="rounded-token border border-border p-2">
                <Link href={`/kamera/${site.id}`} className="font-medium text-primary underline">
                  {site.name}
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <Badge status={site.water_status ? WATER[site.water_status] : NOT_ASSESSED} />
                  {site.risk_level ? <Badge status={RISK[site.risk_level]} /> : null}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {site.water_trend ? `Tren ${TREND_LABEL[site.water_trend]}` : "Tren belum diketahui"}
                  {site.risk_score != null ? ` · skor risiko ${formatNumber(site.risk_score, 2)}` : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold text-muted">Lalu lintas</h3>
        {densityIndex == null ? (
          <p className="text-xs text-muted">Tidak ada kamera lalu lintas aktif yang punya pembanding di sini.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Badge status={DENSITY[densityLevel]} />
              <span className="tabular-nums">{formatNumber(densityIndex, 2)}× kebiasaan</span>
            </div>
            <p className="text-xs text-muted">
              Median dari {trafficSites.length} titik; {busy} di antaranya ramai atau padat. Indeks kepadatan relatif,
              bukan hitungan kendaraan presisi.
            </p>
          </>
        )}
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold text-muted">Hujan</h3>
        {rain ? (
          <>
            <dl className="grid grid-cols-4 gap-2 tabular-nums">
              {(
                [
                  ["Saat ini", rain.precip_now_mm],
                  ["1 jam", rain.precip_next_1h_mm],
                  ["3 jam", rain.precip_next_3h_mm],
                  ["6 jam", rain.precip_next_6h_mm],
                ] as const
              ).map(([label, mm]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="font-semibold">{formatNumber(mm, 1)} mm</dd>
                </div>
              ))}
            </dl>
            <p className="text-xs text-muted">
              Prakiraan Open-Meteo untuk titik {rain.name}, diambil {formatTimeWib(rain.fetched_at)}
              {rain.precip_prob_max_3h != null ? `. Peluang hujan 3 jam ke depan hingga ${rain.precip_prob_max_3h}%` : ""}.
            </p>
          </>
        ) : (
          <p className="text-xs text-muted">Data hujan belum tersedia.</p>
        )}
      </section>
    </div>
  );
}
