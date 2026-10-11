"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import type { AdminCamera } from "@/lib/admin/queries";
import { WATER_KINDS, type CameraPatch } from "@/lib/admin/schemas";
import { HEALTH } from "@/lib/status";

const WATER_KIND_LABEL: Record<string, string> = {
  sungai: "Sungai",
  pompa_in: "Pompa (masuk)",
  pompa_out: "Pompa (keluar)",
  kolam: "Kolam",
  jalan: "Jalan (genangan)",
};
const MODULE_FILTERS = [
  { id: "water", label: "Air" },
  { id: "traffic", label: "Lalu Lintas" },
  { id: "crowd", label: "Ruang Publik" },
  { id: "all", label: "Semua" },
] as const;

type ModuleFilter = (typeof MODULE_FILTERS)[number]["id"];

/** Tabel semua kamera dengan sunting langsung: unggulan, jenis air, sistem sungai. */
export function CameraAdminTable({ initialCameras }: { initialCameras: AdminCamera[] }) {
  const [cameras, setCameras] = useState(initialCameras);
  const [moduleFilter, setModuleFilter] = useState<ModuleFilter>("water");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [query, setQuery] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const needle = query.trim().toLowerCase();
  const visible = cameras.filter(
    (c) =>
      (moduleFilter === "all" || c.modules.includes(moduleFilter)) &&
      (!featuredOnly || c.is_featured) &&
      (!needle || c.name.toLowerCase().includes(needle)),
  );
  const featuredCount = cameras.filter((c) => c.is_featured).length;

  async function save(id: string, patch: CameraPatch) {
    const before = cameras;
    setCameras((list) => list.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setSavingId(id);
    setError(null);
    try {
      const response = await fetch(`/api/admin/cameras/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Gagal menyimpan");
    } catch (cause) {
      setCameras(before);
      setError(`Perubahan tidak tersimpan: ${cause instanceof Error ? cause.message : "kesalahan tak dikenal"}`);
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {MODULE_FILTERS.map((item) => (
          <Button
            key={item.id}
            variant="ghost"
            active={item.id === moduleFilter}
            aria-pressed={item.id === moduleFilter}
            onClick={() => setModuleFilter(item.id)}
          >
            {item.label}
          </Button>
        ))}
        <label className="flex items-center gap-1.5 text-sm">
          <input type="checkbox" checked={featuredOnly} onChange={(e) => setFeaturedOnly(e.target.checked)} />
          Hanya unggulan
        </label>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama kamera"
          aria-label="Cari nama kamera"
          className="min-w-40 flex-1 rounded-token border border-border bg-surface px-3 py-1.5 text-sm sm:max-w-xs"
        />
        <p className="text-sm text-muted">
          {visible.length} kamera · {featuredCount} unggulan
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded-token border border-status-awas bg-surface px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      {visible.length === 0 ? (
        <EmptyState title="Tidak ada kamera yang cocok" reason="Ubah saringan atau kosongkan pencarian." />
      ) : (
        <div className="overflow-x-auto rounded-token border border-border bg-surface">
          <table className="w-full min-w-[46rem] text-left text-sm">
            <thead className="border-b border-border text-xs text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Kamera</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Unggulan</th>
                <th className="px-3 py-2 font-medium">Jenis air</th>
                <th className="px-3 py-2 font-medium">Sistem sungai</th>
                <th className="px-3 py-2 font-medium">Kalibrasi</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((camera) => (
                <tr key={camera.id} className={`border-b border-border last:border-0 ${savingId === camera.id ? "opacity-60" : ""}`}>
                  <td className="px-3 py-2">
                    <Link href={`/kamera/${camera.id}`} className="font-medium hover:text-primary">
                      {camera.name}
                    </Link>
                    <p className="text-xs text-muted">{camera.categories.join(", ")}</p>
                  </td>
                  <td className="px-3 py-2">
                    <Badge status={HEALTH[camera.health ?? "unknown"]} />
                  </td>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={camera.is_featured}
                      aria-label={`Jadikan ${camera.name} kamera unggulan`}
                      onChange={(e) => save(camera.id, { is_featured: e.target.checked })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    {camera.modules.includes("water") ? (
                      <select
                        value={camera.water_kind ?? ""}
                        aria-label={`Jenis air ${camera.name}`}
                        onChange={(e) => save(camera.id, { water_kind: (e.target.value || null) as CameraPatch["water_kind"] })}
                        className="rounded-token border border-border bg-bg px-2 py-1"
                      >
                        <option value="">Belum diisi</option>
                        {WATER_KINDS.map((kind) => (
                          <option key={kind} value={kind}>
                            {WATER_KIND_LABEL[kind]}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {camera.modules.includes("water") ? (
                      <input
                        defaultValue={camera.river_system ?? ""}
                        placeholder="mis. Banjir Kanal Timur"
                        aria-label={`Sistem sungai ${camera.name}`}
                        onBlur={(e) => {
                          const value = e.target.value.trim() || null;
                          if (value !== camera.river_system) void save(camera.id, { river_system: value });
                        }}
                        className="w-44 rounded-token border border-border bg-bg px-2 py-1"
                      />
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {camera.modules.includes("water") ? (
                      <Link href={`/admin/kalibrasi/${camera.id}`} className="font-medium text-primary underline">
                        {camera.is_calibrated ? "Sudah · ubah" : "Kalibrasi"}
                      </Link>
                    ) : (
                      <span className="text-muted">–</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
