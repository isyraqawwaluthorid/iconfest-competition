"use client";

import { useEffect, useMemo, useState } from "react";
import { SCENARIO_GENERATED_AT, SCENARIO_STEPS } from "@/lib/demo/scenario";
import { formatDateTimeWib, formatTimeWib } from "@/lib/time";
import type { CameraOverview } from "@/lib/types";
import { InsightScreen } from "./InsightView";

const STEP_SECONDS = 8;

/**
 * Simulasi kejadian air naik: layar yang sama dengan beranda, diisi langkah demi langkah dari skenario.
 * Kondisi air, peringatan, hujan, dan ringkasan AI berasal dari skenario; kamera, snapshot, dan lalu lintas tetap data langsung.
 */
export function SimulationView({ cameras }: { cameras: CameraOverview[] }) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const step = SCENARIO_STEPS[index];
  const last = SCENARIO_STEPS.length - 1;

  useEffect(() => {
    if (!playing) return;
    const timer = setTimeout(() => (index < last ? setIndex(index + 1) : setPlaying(false)), STEP_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, [playing, index, last]);

  const simulated = useMemo(
    () => cameras.map((camera) => (step.cameras[camera.id] ? { ...camera, ...step.cameras[camera.id], status_updated_at: step.at } : camera)),
    [cameras, step],
  );

  const button = "rounded-control border border-border bg-surface px-3 py-1.5 text-sm font-medium hover:border-primary hover:text-primary disabled:opacity-40 disabled:hover:border-border disabled:hover:text-text";
  return (
    <div className="flex flex-1 flex-col">
      <section aria-label="Kendali simulasi" className="border-b border-border bg-primary-soft px-4 py-3 lg:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="rounded-full bg-primary px-3 py-1 text-xs font-extrabold tracking-widest text-on-primary">SIMULASI</span>
            <p className="text-sm font-semibold">Bukan data langsung</p>
            <p className="text-sm tabular-nums">
              Jam simulasi {formatTimeWib(step.at)} · menit ke-{step.minute} · langkah {index + 1} dari {SCENARIO_STEPS.length}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" className={button} onClick={() => setIndex(index - 1)} disabled={index === 0}>
              Sebelumnya
            </button>
            <button
              type="button"
              className="rounded-control bg-primary px-4 py-1.5 text-sm font-semibold text-on-primary hover:bg-primary-strong"
              onClick={() => {
                if (!playing && index === last) setIndex(0);
                setPlaying(!playing);
              }}
            >
              {playing ? "Jeda" : index === last ? "Ulangi" : "Putar"}
            </button>
            <button type="button" className={button} onClick={() => setIndex(index + 1)} disabled={index === last}>
              Berikutnya
            </button>
          </div>
        </div>
        <p role="status" className="mt-2 text-sm font-medium">
          {step.note}
        </p>
        <p className="mt-1 text-xs text-muted">
          Yang dibuat-buat hanya masukannya: penilaian AI per kamera dan prakiraan hujan. Status, tren, skor risiko,
          peringatan, dan ringkasan AI di layar dihasilkan aturan dan model yang sama dengan sistem yang berjalan
          (disusun {formatDateTimeWib(SCENARIO_GENERATED_AT)}). Snapshot dan halaman kamera tetap menampilkan data langsung.
        </p>
      </section>
      <InsightScreen
        cameras={simulated}
        alerts={step.alerts}
        insight={step.insight}
        readings={step.readings}
        weather={step.weather}
        clock={new Date(step.at).getTime()}
      />
    </div>
  );
}
