"use client";

import Link from "next/link";
import { useMemo } from "react";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { HourBars } from "@/components/traffic/ActivityPanels";
import { Badge } from "@/components/ui/Badge";
import { hourRange, hourWib, peakHour, type ActivityProfile } from "@/lib/activity";
import { useLiveCameras, useNow } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import { CROWD, placeViews, type PlaceView } from "@/lib/public-places";
import { isOnline } from "@/lib/status";
import { formatDateTimeWib } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";

const EVIDENCE_COUNT = 2;
const DEFAULT_HOUR = 12; // hanya dipakai sebelum jam browser diketahui

type Props = {
  initialCameras: CameraOverview[];
  /** Profil aktivitas per jam dari worker; `null` bila belum pernah dihitung atau gagal dimuat. */
  profile: ActivityProfile | null;
};

/** Keramaian ruang publik: satu kartu per tempat, menjawab "seberapa ramai sekarang dibanding biasanya". */
export function PublicSpacesView({ initialCameras, profile }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const now = useNow(60_000);
  const hour = now === null ? DEFAULT_HOUR : hourWib(now);
  const places = useMemo(() => placeViews(cameras, profile, hour), [cameras, profile, hour]);

  return (
    <div className="page space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Keramaian ruang publik</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Seberapa ramai tempat-tempat ini sekarang, dibanding biasanya pada jam yang sama. Dihitung dari pejalan kaki yang
          terlihat pada gambar kamera terakhir. Ini bukan jumlah pengunjung, dan tidak ada pengenalan wajah.
        </p>
      </div>

      {places.length === 0 ? (
        <div className="rounded-token border border-dashed border-border p-6 text-center">
          <p className="font-medium">Belum ada tempat yang dipantau</p>
          <p className="mt-1 text-sm text-muted">Kamera ruang publik tidak ditemukan di daftar kamera aktif.</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} hour={hour} days={profile?.days ?? 0} />
          ))}
        </div>
      )}

      <div className="space-y-1 rounded-token border border-dashed border-border p-4 text-xs text-muted">
        <p className="font-semibold text-text">Yang perlu diketahui tentang angka di halaman ini</p>
        <p>
          Orang yang terdeteksi sedang menaiki sepeda motor tidak dihitung. Pengendara yang motornya tidak terdeteksi masih bisa
          ikut terhitung, dan orang yang terhalang atau jauh dari kamera bisa terlewat.
        </p>
        <p>
          Angka tiap tempat adalah jumlah dari beberapa sudut kamera, jadi orang yang sama bisa terhitung di lebih dari satu
          sudut. Karena pembandingnya dihitung dengan cara yang sama, perbandingan dengan biasanya tetap berlaku.
        </p>
        <p>
          Yang dipantau hanya tempat yang kameranya menghadap ruang pejalan kaki. Kamera wisata yang ternyata menghadap jalan raya
          tidak dipakai di sini.
        </p>
        {profile?.since ? (
          <p>
            Pembanding dihitung dari data sejak {formatDateTimeWib(profile.since)} ({profile.days} hari). Makin banyak hari
            terkumpul, makin mewakili kebiasaan tempat itu.
          </p>
        ) : (
          <p>Pembanding per jam belum tersedia; sistem menghitungnya tiap jam dari gambar kamera.</p>
        )}
      </div>
    </div>
  );
}

function PlaceCard({ place, hour, days }: { place: PlaceView; hour: number; days: number }) {
  const status = CROWD[place.level];
  const peak = peakHour(place.hourly);
  const max = Math.max(...place.hourly.map((value) => value ?? 0), 1);
  const hasPattern = place.hourly.some((value) => value !== null);
  const evidence = place.cameras.filter(isOnline).slice(0, EVIDENCE_COUNT);

  return (
    <section aria-label={place.name} className="rounded-token border border-border bg-surface shadow-card">
      <div className={`tint tone-${status.tone} rounded-t-token p-4`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl leading-tight font-extrabold">{place.name}</h2>
            <p className="mt-0.5 text-xs">{place.about}</p>
          </div>
          <Badge status={status} />
        </div>
        {place.online === 0 ? (
          <p className="mt-3 text-sm">Semua kamera tempat ini sedang tidak mengirim gambar, jadi keramaiannya tidak diketahui.</p>
        ) : (
          <p className="mt-3 text-sm">
            <span className="font-display text-3xl font-bold tabular-nums">{place.now}</span> pejalan kaki terlihat sekarang,
            dijumlahkan dari {place.online} sudut kamera
            {place.usual !== null ? `; biasanya sekitar ${formatNumber(place.usual, 0)} pada pukul ${hourRange(hour)}.` : "."}
          </p>
        )}
        {place.online > 0 && place.usual === null ? (
          <p className="mt-1 text-xs">Belum ada pembanding untuk jam ini, jadi belum bisa disebut sepi atau ramai.</p>
        ) : null}
        {place.usual !== null && place.provisional ? (
          <p className="mt-1 text-xs">Pembanding masih sementara ({days} hari data), jadi hari yang sekadar lebih ramai bisa terbaca ramai.</p>
        ) : null}
      </div>

      <div className="space-y-4 p-4 text-sm">
        <div>
          <p className="text-xs font-semibold text-muted">
            Pola 24 jam{peak !== null ? `: biasanya paling ramai pukul ${hourRange(peak)}` : ""}
          </p>
          {hasPattern ? (
            <HourBars values={place.hourly} max={max} hour={hour} label={`Rata-rata pejalan kaki terlihat di ${place.name} per jam`} />
          ) : (
            <p className="mt-1 rounded-control bg-surface-muted p-3 text-xs text-muted">
              Pola per jam sedang dikumpulkan. Batang pertama muncul setelah sekitar satu jam data.
            </p>
          )}
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold text-muted">Bukti: gambar terakhir dari sudut yang paling ramai</p>
          {evidence.length === 0 ? (
            <p className="rounded-control bg-surface-muted p-3 text-xs text-muted">Tidak ada kamera yang sedang hidup.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {evidence.map((camera) => (
                <div key={camera.id}>
                  <SnapshotView camera={camera} />
                  <p className="mt-1 text-xs">
                    <Link href={`/kamera/${camera.id}`} className="font-semibold underline-offset-2 hover:text-primary hover:underline">
                      {camera.name}
                    </Link>{" "}
                    <span className="text-muted">· {camera.person_count ?? 0} pejalan kaki</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-muted">Semua sudut pandang</p>
          <ul className="divide-y divide-border">
            {place.cameras.map((camera) => (
              <li key={camera.id} className="flex items-center justify-between gap-3 py-1.5 text-xs">
                <Link href={`/kamera/${camera.id}`} className="truncate underline-offset-2 hover:text-primary hover:underline">
                  {camera.name}
                </Link>
                <span className="shrink-0 text-muted tabular-nums">
                  {isOnline(camera) ? `${camera.person_count ?? 0} pejalan kaki` : "kamera mati"}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <FreshnessTag at={place.latest} prefix="Gambar terakhir" />
      </div>
    </section>
  );
}
