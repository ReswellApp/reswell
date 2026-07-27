import { z } from "zod"

/** Client → API request body (JPEG preferred after client compress). */
export const scanBoardDimsRequestSchema = z.object({
  imageBase64: z
    .string()
    .min(1)
    .max(2_200_000, "Image is too large. Take a closer photo of the sticker and try again."),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]),
})

export type ScanBoardDimsRequest = z.infer<typeof scanBoardDimsRequestSchema>

/** Coerce model scalars — Claude often returns numbers for width/volume (e.g. 18.25). */
const nullableDimString = z.preprocess((value) => {
  if (value == null || value === "") return null
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  if (typeof value === "string") {
    const t = value.trim()
    return t.length === 0 ? null : t
  }
  return null
}, z.string().nullable())

const fieldConfidenceSchema = z.preprocess((value) => {
  if (value == null || value === "") return undefined
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return undefined
  const clamped = n > 1 && n <= 100 ? n / 100 : n
  if (clamped < 0 || clamped > 1) return undefined
  return clamped
}, z.number().min(0).max(1).optional())

/** Raw structured output from the vision model (before Reswell parsers). */
export const scanBoardDimsModelOutputSchema = z.object({
  length: nullableDimString,
  widthInches: nullableDimString,
  thicknessInches: nullableDimString,
  volumeL: nullableDimString,
  confidence: z
    .object({
      length: fieldConfidenceSchema,
      widthInches: fieldConfidenceSchema,
      thicknessInches: fieldConfidenceSchema,
      volumeL: fieldConfidenceSchema,
    })
    .optional(),
  rawText: z.preprocess((value) => {
    if (value == null) return undefined
    if (typeof value !== "string") return undefined
    return value.slice(0, 2000)
  }, z.string().max(2000).optional()),
})

export type ScanBoardDimsModelOutput = z.infer<typeof scanBoardDimsModelOutputSchema>

/** Normalized fields safe to offer in the confirm UI / apply to the sell form. */
export const scanBoardDimsNormalizedSchema = z.object({
  boardLength: z.string().nullable(),
  boardWidthInches: z.string().nullable(),
  boardThicknessInches: z.string().nullable(),
  boardVolumeL: z.string().nullable(),
  fieldCount: z.number().int().min(0).max(4),
  rawText: z.string().optional(),
})

export type ScanBoardDimsNormalized = z.infer<typeof scanBoardDimsNormalizedSchema>
