import { insightBodySchema, type Insight } from "../ai-insight";
import type { Alert, CameraOverview, GridWeather } from "../types";
import raw from "./scenario.json";

/**
 * Skenario simulasi kejadian air naik. Masukannya buatan (penilaian AI per kamera dan prakiraan hujan),
 * tetapi status, tren, skor risiko, peringatan, dan ringkasan AI di tiap langkah dihasilkan aturan dan
 * LLM yang sama dengan worker. Disusun oleh `worker/scripts/build_demo_scenario.py`; jangan diubah dengan tangan.
 */
export type ScenarioStep = {
  /** Menit sejak skenario dimulai. */
  minute: number;
  /** Jam simulasi pada langkah ini (ISO). */
  at: string;
  /** Penjelasan untuk penonton: apa yang terjadi di balik layar pada langkah ini. */
  note: string;
  /** Kolom kondisi air per kamera yang menimpa data langsung selama simulasi. */
  cameras: Record<string, Partial<CameraOverview>>;
  alerts: Alert[];
  weather: GridWeather[];
  insight: Insight | null;
};

type RawStep = Omit<ScenarioStep, "insight"> & { insight: { id: string; created_at: string; model: string | null } | null };

export const SCENARIO_GENERATED_AT: string = raw.generated_at;

export const SCENARIO_STEPS: ScenarioStep[] = (raw.steps as unknown as RawStep[]).map((step) => {
  const body = insightBodySchema.safeParse(step.insight);
  return {
    ...step,
    insight: step.insight && body.success ? { id: step.insight.id, created_at: step.insight.created_at, model: step.insight.model, ...body.data } : null,
  };
});
