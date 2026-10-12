import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Icon } from "@/components/ui/Icon";
import type { Insight } from "@/lib/ai-insight";
import { useNow } from "@/lib/hooks";
import { formatNumber, themeDisplay, type DistrictSummary } from "@/lib/insight";
import { DENSITY, NOT_ASSESSED, TREND_LABEL, WATER } from "@/lib/status";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import type { WaterStatus } from "@/lib/types";
import { InsightCard } from "./AiInsight";
import { RainOutlook, TrafficTrend } from "./DistrictTrend";

type Props = {
  summary: DistrictSummary;
  insight: Insight | null;
  cameraNames: Map<string, string>;
  /** Lokasi yang baru sekali dinilai naik oleh AI dan belum dikonfirmasi: id kamera → level yang dinilai. */
  pending: Map<string, WaterStatus>;
  /** Jam yang dipakai panel (ms); diisi halaman simulasi dengan jam skenario. */
  clock?: number;
  onClose: () => void;
};

/** Rincian satu kecamatan: temuan AI, air, lalu lintas, dan hujan, dengan kamera hanya sebagai sumber data. */
export function DistrictPanel({ summary, insight, cameraNames, pending, clock, onClose }: Props) {
  const { district, cameras, online, waterSites, trafficSites, densityIndex, densityLevel, busy, rain } = summary;
  const sites = [...waterSites].sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
  const risk = themeDisplay(summary, "risk");
  // Temuan AI yang menyangkut lokasi di kecamatan ini; temuan tanpa lokasi hanya tampil di ringkasan kota.
  const realNow = useNow();
  const now = clock ?? realNow;
  // Status terkonfirmasi yang berganti dalam 24 jam terakhir; penilaian AI tunggal tidak dihitung sebagai perubahan.
  const changed = sites.filter(
    (site) => now !== null && site.water_status_since != null && now - new Date(site.water_status_since).getTime() < 24 * 3_600_000,
  );
  const trafficIds = cameras.filter((camera) => camera.modules.includes("traffic")).map((camera) => camera.id);
  const local = new Set(cameras.map((camera) => camera.id));
  const findings = insight?.items.filter((item) => item.camera_ids.some((id) => local.has(id))) ?? [];
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

      {findings.length > 0 ? (
        <section className="space-y-2">
          <h3 className="label-caps flex items-center gap-1.5 text-muted">
            <Icon name="alert" size={14} /> Temuan AI di sini
          </h3>
          <ul className="space-y-2">
            {findings.map((item, index) => (
              <li key={`${insight?.id}-${index}`}>
                <InsightCard item={item} cameraNames={cameraNames} />
              </li>
            ))}
          </ul>
          {insight ? <p className="text-xs text-muted">Ditulis AI dari data sistem, {formatDateTimeWib(insight.created_at)}.</p> : null}
        </section>
      ) : null}

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
                  {pending.has(site.id) ? (
                    <p className="mt-1 text-xs font-semibold">
                      AI baru sekali menilai {WATER[pending.get(site.id) as WaterStatus].label.toLowerCase()}; status resmi menunggu penilaian kedua.
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {sites.length > 0 && now !== null ? (
          <p className="text-xs text-muted">
            {changed.length === 0
              ? "Tidak ada perubahan status dalam 24 jam terakhir."
              : `Perubahan status 24 jam terakhir: ${changed
                  .map((site) => `${site.name} menjadi ${WATER[site.water_status ?? "tidak_dapat_dinilai"].label.toLowerCase()} ${formatDateTimeWib(site.water_status_since as string)}`)
                  .join("; ")}.`}
          </p>
        ) : null}
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
              Median {trafficSites.length} titik; {busy} ramai atau padat. Dibanding jam yang sama di hari-hari sebelumnya
              {trafficSites.some((site) => site.baseline_is_provisional) ? " (pembanding masih sementara)" : ""}; bukan hitungan
              kendaraan presisi.
            </p>
          </div>
        )}
        {trafficIds.length > 0 ? <TrafficTrend cameraIds={trafficIds} /> : null}
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
            <RainOutlook rain={rain} />
          </div>
        ) : (
          <p className="rounded-control bg-surface-muted p-3 text-muted">Data hujan belum tersedia.</p>
        )}
      </section>
    </div>
  );
}
