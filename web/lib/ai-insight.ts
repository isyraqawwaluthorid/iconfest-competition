import { z } from "zod";
import type { IconName } from "@/components/ui/Icon";
import { ALERT, WATER, type StatusDisplay } from "./status";

/**
 * Insight yang ditulis LLM dari fakta sistem (tabel `insights`, kolom `body`).
 * Bentuknya sama dengan `ai/schemas/insight.schema.json`; divalidasi ulang di sini sebelum ditampilkan.
 */
export const insightItemSchema = z.object({
  title: z.string(),
  body: z.string(),
  cause: z.string(),
  impact: z.string(),
  module: z.enum(["air", "lalu_lintas", "ruang_publik", "lintas_modul", "sistem"]),
  level: z.enum(["info", "waspada", "siaga", "awas"]),
  camera_ids: z.array(z.string()),
  evidence: z.array(z.string()),
  recommendations: z.array(
    z.object({ audience: z.enum(["bpbd", "pu", "dishub", "perencana", "warga"]), action: z.string() }),
  ),
});

export const insightBodySchema = z.object({
  headline: z.string(),
  summary: z.string(),
  overall_level: z.enum(["aman", "perlu_perhatian", "waspada", "siaga", "awas"]),
  items: z.array(insightItemSchema).max(5),
});

export type InsightItem = z.infer<typeof insightItemSchema>;
export type Insight = z.infer<typeof insightBodySchema> & { id: string; created_at: string; model: string | null };

/** Worker menyegarkan insight paling lambat tiap 60 menit; lebih tua dari ini berarti pembaruannya tertunda. */
export const INSIGHT_STALE_MINUTES = 120;

/** "Aman" tidak dipakai sebagai label: yang diketahui hanya keadaan lokasi yang dipantau. */
export const INSIGHT_LEVEL: Record<Insight["overall_level"], StatusDisplay> = {
  aman: { label: "Tidak ada temuan penting", tone: "normal" },
  perlu_perhatian: { label: "Perlu perhatian", tone: "density-normal" },
  waspada: WATER.waspada,
  siaga: WATER.siaga,
  awas: WATER.awas,
};

export const ITEM_LEVEL = ALERT;

export const MODULE_DISPLAY: Record<InsightItem["module"], { label: string; icon: IconName }> = {
  air: { label: "Air", icon: "droplet" },
  lalu_lintas: { label: "Lalu lintas", icon: "car" },
  ruang_publik: { label: "Ruang publik", icon: "pin" },
  lintas_modul: { label: "Lintas modul", icon: "rain" },
  sistem: { label: "Sistem", icon: "camera" },
};

export const AUDIENCE_LABEL: Record<InsightItem["recommendations"][number]["audience"], string> = {
  bpbd: "BPBD",
  pu: "Dinas PU",
  dishub: "Dishub",
  perencana: "Perencana kota",
  warga: "Warga",
};
