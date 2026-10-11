"use client";

import Link from "next/link";
import { useState } from "react";
import { Legend } from "@/components/map/Legend";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLiveCameras, useNow } from "@/lib/hooks";
import { displayFor, isOnline, MAP_LAYERS, TONE_BG, type MapLayer } from "@/lib/status";
import { snapshotUrl } from "@/lib/storage";
import { formatTimeWib, timeAgo } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";

const WATER_KIND_LABEL: Record<string, string> = {
  sungai: "Sungai",
  pompa_in: "Pompa (sisi masuk)",
  pompa_out: "Pompa (sisi keluar)",
  kolam: "Kolam",
  jalan: "Jalan (genangan)",
};

/** Grid snapshot terbaru semua kamera. Memakai gambar dari Storage, bukan video live, agar ringan. */
export function MosaicView({ initialCameras }: { initialCameras: CameraOverview[] }) {
  const cameras = useLiveCameras(initialCameras);
  const now = useNow();
  const [layer, setLayer] = useState<MapLayer>("health");
  const [onlineOnly, setOnlineOnly] = useState(true);
  const [query, setQuery] = useState("");

  const requiredModule = MAP_LAYERS.find((l) => l.id === layer)?.module ?? null;
  const needle = query.trim().toLowerCase();
  const visible = cameras.filter(
    (c) =>
      (!requiredModule || c.modules.includes(requiredModule)) &&
      (!onlineOnly || isOnline(c)) &&
      (!needle || c.name.toLowerCase().includes(needle)),
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Saring kamera">
        {MAP_LAYERS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            active={item.id === layer}
            aria-pressed={item.id === layer}
            onClick={() => setLayer(item.id)}
          >
            {item.id === "health" ? "Semua" : item.label}
          </Button>
        ))}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={onlineOnly} onChange={(e) => setOnlineOnly(e.target.checked)} />
          Hanya kamera aktif
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama kamera"
          aria-label="Cari nama kamera"
          className="min-w-40 flex-1 rounded-token border border-border bg-surface px-3 py-1.5 text-sm sm:max-w-xs"
        />
        <p className="text-sm text-muted">{visible.length} kamera</p>
      </div>
      <Legend layer={layer} />

      {visible.length === 0 ? (
        <EmptyState
          title="Tidak ada kamera yang cocok"
          reason="Ubah saringan, kosongkan pencarian, atau matikan pilihan hanya kamera aktif."
        />
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {visible.map((camera) => (
            <li key={camera.id}>
              <CameraTile camera={camera} layer={layer} now={now} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CameraTile({ camera, layer, now }: { camera: CameraOverview; layer: MapLayer; now: number | null }) {
  const status = displayFor(camera, layer);
  const online = isOnline(camera);
  const taken = camera.latest_snapshot_at;
  return (
    <Link
      href={`/kamera/${camera.id}`}
      className="block overflow-hidden rounded-token border border-border bg-surface hover:border-primary"
    >
      <div className={`h-1.5 ${TONE_BG[status.tone]}`} aria-hidden />
      <div className="aspect-video bg-border">
        {camera.latest_snapshot_path ? (
          // Snapshot sudah berukuran web dan berganti tiap 5 menit; lazy loading menjaga halaman tetap ringan.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl(camera.latest_snapshot_path, taken)}
            alt={`Snapshot kamera ${camera.name}`}
            loading="lazy"
            decoding="async"
            className={`h-full w-full object-cover ${online ? "" : "opacity-60 grayscale"}`}
          />
        ) : (
          <p className="flex h-full items-center justify-center p-2 text-center text-xs text-muted">Belum ada snapshot</p>
        )}
      </div>
      <div className="space-y-0.5 p-2">
        <p className="truncate text-sm font-medium" title={camera.name}>
          {camera.name}
        </p>
        <p className="flex items-center gap-1.5 text-xs">
          <span aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[status.tone]}`} />
          {status.label}
        </p>
        <p className="truncate text-xs text-muted">
          {camera.water_kind ? `${WATER_KIND_LABEL[camera.water_kind] ?? camera.water_kind} · ` : ""}
          {taken ? (now === null ? formatTimeWib(taken) : timeAgo(taken, now)) : "tanpa gambar"}
        </p>
      </div>
    </Link>
  );
}
