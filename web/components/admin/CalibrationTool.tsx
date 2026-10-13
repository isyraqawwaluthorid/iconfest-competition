"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent } from "react";
import { Button } from "@/components/ui/Button";
import type { AdminCameraDetail } from "@/lib/admin/queries";
import { REFERENCE_LEVELS, WATER_KINDS, type CalibrationInput, type ReferenceLevel } from "@/lib/admin/schemas";
import { snapshotUrl } from "@/lib/storage";

type Point = [number, number];
type Lines = Partial<Record<ReferenceLevel, Point[]>>;
type Mode = "roi" | ReferenceLevel;

const LEVEL_LABEL: Record<ReferenceLevel, string> = { normal: "Normal", waspada: "Waspada", siaga: "Siaga", awas: "Awas" };
// Arti tiap garis bagi penilaian AI (lihat worker/semarsight_worker/prompts/water_vision.md).
const LEVEL_HINT: Record<ReferenceLevel, string> = {
  normal: "Klik dua titik pada benda tetap, rata dengan muka air saat kondisi normal. Garis ini hanya patokan; air di sekitarnya masih normal.",
  waspada: "Klik dua titik pada benda tetap, di ketinggian yang bila tercapai air berarti waspada. Beri jarak yang jelas dari garis Normal.",
  siaga: "Klik dua titik pada benda tetap, di ketinggian yang bila tercapai air berarti siaga.",
  awas: "Klik dua titik pada benda tetap, di ketinggian yang bila tercapai air berarti awas (hampir atau sudah meluap).",
};
const WATER_KIND_LABEL: Record<string, string> = {
  sungai: "Sungai",
  pompa_in: "Pompa (sisi masuk)",
  pompa_out: "Pompa (sisi keluar)",
  kolam: "Kolam",
  jalan: "Jalan (genangan)",
};

function initialLines(camera: AdminCameraDetail): Lines {
  const lines: Lines = {};
  for (const line of camera.reference_lines ?? []) lines[line.level] = line.points;
  return lines;
}

/**
 * Alat kalibrasi kamera air. Koordinat disimpan ternormalisasi 0..1 terhadap lebar dan tinggi gambar,
 * sehingga tetap berlaku jika resolusi stream berubah.
 */
export function CalibrationTool({ camera }: { camera: AdminCameraDetail }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("roi");
  const [roi, setRoi] = useState<Point[]>(camera.roi?.points ?? []);
  const [lines, setLines] = useState<Lines>(() => initialLines(camera));
  const [notes, setNotes] = useState(camera.calibration_notes ?? "");
  const [waterKind, setWaterKind] = useState(camera.water_kind ?? "");
  const [riverSystem, setRiverSystem] = useState(camera.river_system ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function addPoint(event: MouseEvent<SVGSVGElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const point: Point = [
      Math.min(1, Math.max(0, (event.clientX - box.left) / box.width)),
      Math.min(1, Math.max(0, (event.clientY - box.top) / box.height)),
    ];
    setMessage(null);
    if (mode === "roi") {
      setRoi((points) => [...points, point]);
    } else {
      // Garis acuan = dua titik; klik ketiga memulai garis baru untuk level yang sama.
      setLines((current) => {
        const existing = current[mode] ?? [];
        return { ...current, [mode]: existing.length >= 2 ? [point] : [...existing, point] };
      });
    }
  }

  function undo() {
    if (mode === "roi") setRoi((points) => points.slice(0, -1));
    else setLines((current) => ({ ...current, [mode]: (current[mode] ?? []).slice(0, -1) }));
  }

  function clearCurrent() {
    if (mode === "roi") setRoi([]);
    else setLines((current) => ({ ...current, [mode]: [] }));
  }

  async function save(saveReference: CalibrationInput["save_reference"]) {
    if (roi.length < 3) {
      setMessage({ kind: "error", text: "Area air butuh minimal 3 titik." });
      return;
    }
    const completeLines = REFERENCE_LEVELS.filter((level) => lines[level]?.length === 2).map((level) => ({
      level,
      points: lines[level] as [Point, Point],
    }));
    const payload: CalibrationInput = {
      roi: { points: roi },
      reference_lines: completeLines,
      calibration_notes: notes.trim() || null,
      water_kind: (waterKind || null) as CalibrationInput["water_kind"],
      river_system: riverSystem.trim() || null,
      save_reference: saveReference,
    };
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/calibration/${camera.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error ?? "Gagal menyimpan");
      const referenceNote =
        saveReference === "day" ? " Foto referensi siang diperbarui." : saveReference === "night" ? " Foto referensi malam diperbarui." : "";
      setMessage({ kind: "ok", text: `Kalibrasi tersimpan (${completeLines.length} garis acuan).${referenceNote}` });
      router.refresh();
    } catch (cause) {
      setMessage({ kind: "error", text: cause instanceof Error ? cause.message : "Gagal menyimpan" });
    } finally {
      setBusy(false);
    }
  }

  const currentCount = mode === "roi" ? roi.length : (lines[mode]?.length ?? 0);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Yang sedang digambar">
          <Button variant="ghost" active={mode === "roi"} aria-pressed={mode === "roi"} onClick={() => setMode("roi")}>
            Area air ({roi.length} titik)
          </Button>
          {REFERENCE_LEVELS.map((level) => (
            <Button key={level} variant="ghost" active={mode === level} aria-pressed={mode === level} onClick={() => setMode(level)}>
              <span aria-hidden className={`mr-1.5 inline-block h-2.5 w-2.5 rounded-full calib-swatch level-${level}`} />
              Garis {LEVEL_LABEL[level]}
              {lines[level]?.length === 2 ? " ✓" : ""}
            </Button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Button variant="ghost" onClick={undo} disabled={currentCount === 0}>
            Batalkan titik terakhir
          </Button>
          <Button variant="ghost" onClick={clearCurrent} disabled={currentCount === 0}>
            Hapus {mode === "roi" ? "area" : "garis ini"}
          </Button>
          <p className="text-muted">
            {mode === "roi"
              ? "Klik mengelilingi permukaan air (atau badan jalan untuk kamera genangan)."
              : LEVEL_HINT[mode]}
          </p>
        </div>

        <div className="relative overflow-hidden rounded-token border border-border bg-border">
          {camera.latest_snapshot_path ? (
            <>
              {/* Gambar apa adanya (tanpa pemotongan) supaya koordinat klik sama dengan koordinat frame. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={snapshotUrl(camera.latest_snapshot_path, camera.latest_snapshot_at)}
                alt={`Snapshot kamera ${camera.name} untuk kalibrasi`}
                className="block w-full select-none"
                draggable={false}
              />
              <svg
                viewBox="0 0 1 1"
                preserveAspectRatio="none"
                onClick={addPoint}
                className="absolute inset-0 h-full w-full cursor-crosshair"
                role="img"
                aria-label="Lapisan gambar kalibrasi"
              >
                {roi.length >= 2 ? (
                  <polygon points={roi.map((p) => p.join(",")).join(" ")} className="calib-roi" vectorEffect="non-scaling-stroke" />
                ) : null}
                {roi.map((p, i) => (
                  <line key={`roi-${i}`} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1]} className="calib-dot calib-roi-dot" vectorEffect="non-scaling-stroke" />
                ))}
                {REFERENCE_LEVELS.map((level) => {
                  const points = lines[level] ?? [];
                  return (
                    <g key={level} className={`level-${level}`}>
                      {points.length === 2 ? (
                        <line
                          x1={points[0][0]} y1={points[0][1]} x2={points[1][0]} y2={points[1][1]}
                          className="calib-line" vectorEffect="non-scaling-stroke"
                        />
                      ) : null}
                      {points.map((p, i) => (
                        <line key={i} x1={p[0]} y1={p[1]} x2={p[0]} y2={p[1]} className="calib-dot" vectorEffect="non-scaling-stroke" />
                      ))}
                    </g>
                  );
                })}
              </svg>
            </>
          ) : (
            <p className="p-8 text-center text-sm text-muted">
              Kamera ini belum punya snapshot, jadi belum bisa dikalibrasi. Tunggu sampai worker berhasil mengambil gambarnya.
            </p>
          )}
        </div>
        <p className="text-xs text-muted">Gambar: snapshot terakhir kamera. Sumber: PANTAUSEMAR, Pemerintah Kota Semarang.</p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm">
          Jenis air
          <select value={waterKind} onChange={(e) => setWaterKind(e.target.value)} className="mt-1 block w-full rounded-token border border-border bg-surface px-2 py-1.5">
            <option value="">Belum diisi</option>
            {WATER_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {WATER_KIND_LABEL[kind]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          Sistem sungai
          <input
            value={riverSystem}
            onChange={(e) => setRiverSystem(e.target.value)}
            placeholder="mis. Banjir Kanal Timur"
            className="mt-1 block w-full rounded-token border border-border bg-surface px-2 py-1.5"
          />
        </label>
        <label className="block text-sm">
          Catatan untuk AI
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={4}
            placeholder="mis. Garis siaga = anak tangga ke-3 di dinding kiri. Air normal menyentuh dasar pilar."
            className="mt-1 block w-full rounded-token border border-border bg-surface px-2 py-1.5"
          />
        </label>

        <div className="space-y-2">
          <Button onClick={() => save(null)} disabled={busy} className="w-full">
            {busy ? "Menyimpan…" : "Simpan kalibrasi"}
          </Button>
          <Button variant="ghost" onClick={() => save("day")} disabled={busy} className="w-full">
            Simpan + jadikan gambar ini referensi siang
          </Button>
          <Button variant="ghost" onClick={() => save("night")} disabled={busy} className="w-full">
            Simpan + jadikan gambar ini referensi malam
          </Button>
          <p className="text-xs text-muted">
            Foto referensi harus menunjukkan kondisi normal. Referensi siang diambil saat terang, referensi malam saat gelap.
          </p>
        </div>

        {message ? (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={`rounded-token border px-3 py-2 text-sm ${message.kind === "error" ? "border-status-awas" : "border-status-normal"}`}
          >
            {message.text}
          </p>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          {(["day", "night"] as const).map((slot) => {
            const path = slot === "day" ? camera.reference_image_day : camera.reference_image_night;
            return (
              <figure key={slot} className="text-xs text-muted">
                <div className="aspect-video overflow-hidden rounded-token border border-border bg-border">
                  {path ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={snapshotUrl(path, camera.latest_snapshot_at)} alt={`Referensi ${slot === "day" ? "siang" : "malam"}`} className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <figcaption className="mt-1">
                  Referensi {slot === "day" ? "siang" : "malam"}: {path ? "ada" : "belum ada"}
                </figcaption>
              </figure>
            );
          })}
        </div>
      </div>
    </div>
  );
}
