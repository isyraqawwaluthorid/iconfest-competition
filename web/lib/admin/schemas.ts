import { z } from "zod";

/** Koordinat gambar ternormalisasi 0..1 (lihat docs/04-database.md). */
const point = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]);

export const WATER_KINDS = ["sungai", "pompa_in", "pompa_out", "kolam", "jalan"] as const;
export const REFERENCE_LEVELS = ["normal", "waspada", "siaga", "awas"] as const;

export const cameraPatchSchema = z
  .object({
    is_featured: z.boolean(),
    is_active: z.boolean(),
    water_kind: z.enum(WATER_KINDS).nullable(),
    river_system: z.string().trim().max(80).nullable(),
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, "Tidak ada kolom yang diubah");

export const calibrationSchema = z.object({
  roi: z.object({ points: z.array(point).min(3).max(40) }),
  reference_lines: z
    .array(z.object({ level: z.enum(REFERENCE_LEVELS), points: z.tuple([point, point]) }))
    .max(REFERENCE_LEVELS.length)
    .refine((lines) => new Set(lines.map((l) => l.level)).size === lines.length, "Satu garis per level"),
  calibration_notes: z.string().trim().max(500).nullable(),
  water_kind: z.enum(WATER_KINDS).nullable(),
  river_system: z.string().trim().max(80).nullable(),
  save_reference: z.enum(["day", "night"]).nullable(),
});

export type CameraPatch = z.infer<typeof cameraPatchSchema>;
export type CalibrationInput = z.infer<typeof calibrationSchema>;
export type ReferenceLevel = (typeof REFERENCE_LEVELS)[number];
export type WaterKind = (typeof WATER_KINDS)[number];
