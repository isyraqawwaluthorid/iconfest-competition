"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useMemo } from "react";
import { SnapshotView } from "@/components/camera/SnapshotView";
import { MapThemeToggle } from "@/components/map/MapThemeToggle";
import { FreshnessTag } from "@/components/system/FreshnessTag";
import { HourBars } from "@/components/traffic/ActivityPanels";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";
import { hourRange, hourWib, peakHour, type ActivityProfile } from "@/lib/activity";
import { useLiveCameras, useNow } from "@/lib/hooks";
import { formatNumber } from "@/lib/insight";
import { mapThemeClass, useMapTheme } from "@/lib/map-theme";
import { CROWD, placeViews, type PlaceView, type SpotView } from "@/lib/public-places";
import { isOnline, TONE_BG } from "@/lib/status";
import { formatDateTimeWib } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";

// Leaflet membutuhkan `window`, jadi peta hanya dimuat di browser.
const PlacesMap = dynamic(() => import("./PlacesMap"), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full" />,
});

const DEFAULT_HOUR = 12; // hanya dipakai sebelum jam browser diketahui

type Props = {
  initialCameras: CameraOverview[];
  /** Profil aktivitas per jam dari worker; `null` bila belum pernah dihitung atau gagal dimuat. */
  profile: ActivityProfile | null;
};

/** Keramaian ruang publik: peta kecil dan satu kartu per tempat, menjawab "seberapa ramai sekarang dibanding biasanya". */
export function PublicSpacesView({ initialCameras, profile }: Props) {
  const cameras = useLiveCameras(initialCameras);
  const now = useNow(60_000);
  const mapTheme = useMapTheme();
  const hour = now === null ? DEFAULT_HOUR : hourWib(now);
  const places = useMemo(() => placeViews(cameras, profile, hour), [cameras, profile, hour]);
  const total = places.reduce((sum, place) => sum + place.now, 0);
  // Satuan yang dibandingkan adalah titik, bukan tempat: tujuh titik yang setara lebih adil dibaca daripada tiga
  // tempat yang jumlah kameranya berbeda jauh.
  const spots = useMemo(
    () =>
      places
        .flatMap((place) => place.spots.map((spot) => ({ ...spot, placeId: place.id, label: place.spots.length === 1 ? place.name : `${place.name} · ${spot.name}` })))
        .sort((a, b) => b.now - a.now),
    [places],
  );
  const busiest = Math.max(...spots.map((spot) => spot.now), 1);
  const showPlace = (placeId: string) => document.getElementById(`tempat-${placeId}`)?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="page space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Keramaian ruang publik</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted">
            Seberapa ramai tempat-tempat ini sekarang, dibanding biasanya pada jam yang sama. Dihitung dari pejalan kaki yang
            terlihat pada gambar kamera terakhir. Ini bukan jumlah pengunjung, dan tidak ada pengenalan wajah.
          </p>
        </div>
        {places.length > 0 ? (
          <p className="text-sm text-muted">
            <span className="font-display text-2xl font-bold text-text tabular-nums">{total}</span> pejalan kaki terlihat di{" "}
            {places.length} tempat
          </p>
        ) : null}
      </div>

      {places.length === 0 ? (
        <div className="rounded-token border border-dashed border-border p-6 text-center">
          <p className="font-medium">Belum ada tempat yang dipantau</p>
          <p className="mt-1 text-sm text-muted">Kamera ruang publik tidak ditemukan di daftar kamera aktif.</p>
        </div>
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem]">
            <section aria-label="Peta tempat yang dipantau" className={`relative h-80 overflow-hidden rounded-token border border-border ${mapThemeClass(mapTheme)}`}>
              <PlacesMap places={places} onSelect={showPlace} />
              <div className="map-panel absolute top-3 left-3 p-1">
                <MapThemeToggle />
              </div>
            </section>
            <section aria-label="Titik teramai sekarang" className="rounded-token border border-border bg-surface p-4 shadow-card">
              <p className="label-caps text-muted">Titik teramai sekarang</p>
              <ol className="mt-2 space-y-2">
                {spots.map((spot) => (
                  <li key={spot.label}>
                    <button type="button" onClick={() => showPlace(spot.placeId)} className="block w-full text-left hover:text-primary">
                      <span className="flex items-baseline justify-between gap-2 text-xs">
                        <span className="truncate font-semibold">{spot.label}</span>
                        <span className="shrink-0 text-muted tabular-nums">{spot.online === 0 ? "kamera mati" : `${spot.now} pejalan kaki`}</span>
                      </span>
                      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-surface-muted">
                        <span className={`block h-full rounded-full ${TONE_BG[CROWD[spot.level].tone]}`} style={{ width: `${Math.round((spot.now / busiest) * 100)}%` }} />
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
              <p className="mt-3 text-[11px] text-muted">Warna batang mengikuti tingkat keramaian dibanding biasanya; abu-abu berarti pembandingnya belum ada.</p>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {places.map((place, index) => (
              // Tempat teramai mendapat lebar penuh, supaya titik-titiknya muat berdampingan.
              <PlaceCard key={place.id} place={place} hour={hour} days={profile?.usual_days ?? 0} wide={index === 0} />
            ))}
          </div>
        </>
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
          Yang dipantau hanya tempat yang kameranya menghadap ruang pejalan kaki. Kamera jalan tidak dipakai di sini, karena di
          sana pengendara motor sering terhitung sebagai pejalan kaki.
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

function PlaceCard({ place, hour, days, wide }: { place: PlaceView; hour: number; days: number; wide: boolean }) {
  const status = CROWD[place.level];
  const peak = peakHour(place.hourly);
  const max = Math.max(...place.hourly.map((value) => value ?? 0), 1);
  const hasPattern = place.hourly.some((value) => value !== null);

  return (
    <section
      id={`tempat-${place.id}`}
      aria-label={place.name}
      className={`scroll-mt-24 rounded-token border border-border bg-surface shadow-card ${wide ? "lg:col-span-2" : ""}`}
    >
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
            {place.usual !== null ? `; pada hari-hari sebelumnya rata-rata ${formatNumber(place.usual, 0)} pada pukul ${hourRange(hour)}.` : "."}
          </p>
        )}
        {place.online > 0 && place.usual === null ? (
          <p className="mt-1 text-xs">
            Belum ada data jam ini dari hari sebelumnya, jadi belum bisa disebut sepi atau ramai. Pembanding muncul setelah sehari
            data.
          </p>
        ) : null}
        {place.usual !== null && place.provisional ? (
          <p className="mt-1 text-xs">Pembanding masih sementara ({days} hari data), jadi hari yang sekadar lebih ramai bisa terbaca ramai.</p>
        ) : null}
      </div>

      <div className="space-y-4 p-4 text-sm">
        <div className={wide ? "lg:max-w-xl" : ""}>
          <p className="text-xs font-semibold text-muted">
            Pola 24 jam{peak !== null ? `: sejauh ini paling ramai pukul ${hourRange(peak)}` : ""}
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
          <p className="mb-1.5 text-xs font-semibold text-muted">
            {place.spots.length > 1 ? `Per titik (${place.spots.length})` : "Bukti: gambar terakhir kamera"}
          </p>
          <div className={`grid gap-3 sm:grid-cols-2 ${wide ? "lg:grid-cols-3" : ""}`}>
            {place.spots.map((spot) => (
              <SpotTile key={spot.name} spot={spot} single={place.spots.length === 1} />
            ))}
          </div>
        </div>
        <FreshnessTag at={place.latest} prefix="Gambar terakhir" />
      </div>
    </section>
  );
}

/** Satu titik di dalam tempat: gambar dari sudut teramai sebagai bukti, tingkatnya sendiri, dan jumlah yang terlihat. */
function SpotTile({ spot, single }: { spot: SpotView; single: boolean }) {
  const evidence = spot.cameras.find(isOnline) ?? spot.cameras[0];
  return (
    <div>
      <SnapshotView camera={evidence} />
      <div className="mt-1.5 flex items-start justify-between gap-2">
        <div className="min-w-0 text-xs">
          <p className="font-semibold">{single ? evidence.name : spot.name}</p>
          <p className="text-muted">
            {spot.online === 0
              ? "kamera mati"
              : `${spot.now} pejalan kaki${spot.usual !== null ? `, biasanya ±${formatNumber(spot.usual, 0)}` : ""} · ${spot.cameras.length} sudut kamera`}
          </p>
          <p className="mt-0.5 flex flex-wrap gap-x-2 text-muted">
            {spot.cameras.map((camera) => (
              <Link key={camera.id} href={`/kamera/${camera.id}`} className="underline-offset-2 hover:text-primary hover:underline">
                {camera.name} ({isOnline(camera) ? (camera.person_count ?? 0) : "mati"})
              </Link>
            ))}
          </p>
        </div>
        {single ? null : <Badge status={CROWD[spot.level]} />}
      </div>
    </div>
  );
}
