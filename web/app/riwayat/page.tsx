import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { nearbySentence } from "@/lib/cross-module";
import { EVENT_KIND_LABEL, formatDuration } from "@/lib/events";
import { getEvents } from "@/lib/queries";
import { NOT_ASSESSED, WATER } from "@/lib/status";
import { formatDateTimeWib } from "@/lib/time";

export const metadata: Metadata = { title: "Riwayat kejadian" };

export default function HistoryPage() {
  return (
    <div className="page space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Riwayat kejadian</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Satu baris untuk tiap periode sebuah lokasi air berstatus resmi di atas normal: kapan mulai, seberapa tinggi
            puncaknya, berapa lama sampai kembali normal, dan keadaan lalu lintas di sekitarnya pada saat terpadat (terjadi
            bersamaan, bukan bukti sebab-akibat). Dicatat otomatis dari status resmi, bukan dari penilaian AI tunggal.
          </p>
        </div>
        <a
          href="/api/export/events"
          className="rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary"
        >
          Unduh CSV
        </a>
      </div>
      <Suspense fallback={<Skeleton className="h-64 w-full" />}>
        <History />
      </Suspense>
    </div>
  );
}

async function History() {
  const events = await getEvents();
  if (events.length === 0) {
    return (
      <div className="rounded-token border border-dashed border-border p-6 text-center">
        <p className="font-medium">Belum ada kejadian yang tercatat</p>
        <p className="mx-auto mt-1 max-w-xl text-sm text-muted">
          Sejak sistem mulai memantau pada 10 Oktober 2026, belum ada lokasi yang status resminya naik di atas normal.
          Begitu itu terjadi, kejadiannya muncul di sini dengan sendirinya.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/simulasi" className="font-semibold text-primary hover:underline">
            Lihat simulasi kejadian
          </Link>{" "}
          <span className="text-muted">untuk melihat bagaimana sistem bereaksi saat air naik.</span>
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-token border border-border bg-surface">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border text-xs text-muted">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Mulai</th>
            <th className="px-4 py-2.5 font-semibold">Lokasi</th>
            <th className="px-4 py-2.5 font-semibold">Jenis</th>
            <th className="px-4 py-2.5 font-semibold">Puncak</th>
            <th className="px-4 py-2.5 font-semibold">Lama</th>
            <th className="px-4 py-2.5 font-semibold">Selesai</th>
            <th className="px-4 py-2.5 font-semibold">Lalu lintas di sekitarnya</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {events.map((event) => (
            <tr key={event.id}>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatDateTimeWib(event.started_at)}</td>
              <td className="px-4 py-2.5">
                <Link href={`/kamera/${event.camera_id}`} className="font-semibold underline-offset-2 hover:text-primary hover:underline">
                  {event.camera_name}
                </Link>
              </td>
              <td className="px-4 py-2.5">{EVENT_KIND_LABEL[event.kind]}</td>
              <td className="px-4 py-2.5">
                <Badge status={event.peak_status ? WATER[event.peak_status] : NOT_ASSESSED} />
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                {event.duration_minutes != null ? formatDuration(event.duration_minutes) : "–"}
              </td>
              <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">
                {event.ended_at ? formatDateTimeWib(event.ended_at) : <span className="font-semibold">masih berlangsung</span>}
              </td>
              <td className="max-w-xs px-4 py-2.5 text-xs text-muted">
                {event.traffic_impact
                  ? nearbySentence(
                      event.traffic_impact.cameras,
                      event.traffic_impact.busier_than_usual,
                      event.traffic_impact.busiest.name,
                      event.traffic_impact.baseline === "sementara",
                    ).replace("Lalu lintas di sekitarnya (1 km): ", "Saat terpadat: ")
                  : "Kurang dari dua titik lalu lintas dalam 1 km"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
