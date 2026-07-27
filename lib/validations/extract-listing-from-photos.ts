import { z } from "zod"
import {
  CONSTRUCTION_OPTIONS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
} from "@/lib/boards-browse-facets"

const FIN_SETUP_SLUGS = FIN_SETUP_OPTIONS.map((o) => o.value) as [string, ...string[]]
const FIN_SYSTEM_SLUGS = FIN_SYSTEM_OPTIONS.map((o) => o.value) as [string, ...string[]]
const CONSTRUCTION_SLUGS = CONSTRUCTION_OPTIONS.map((o) => o.value) as [string, ...string[]]

/** Coerce model scalars — Claude often returns numbers for volume/confidence. */
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
  // Accept 0–100 style percentages from the model.
  const clamped = n > 1 && n <= 100 ? n / 100 : n
  if (clamped < 0 || clamped > 1) return undefined
  return clamped
}, z.number().min(0).max(1).optional())

/** Client → API: thumbnail URLs from just-uploaded listing photos. */
export const extractListingFromPhotosRequestSchema = z.object({
  imageUrls: z
    .array(z.string().url().max(2000))
    .min(1)
    .max(6, "Send at most 6 photo URLs."),
})

export type ExtractListingFromPhotosRequest = z.infer<
  typeof extractListingFromPhotosRequestSchema
>

/** Raw structured output from the vision model. */
export const extractListingFromPhotosModelOutputSchema = z.object({
  length: nullableDimString,
  widthInches: nullableDimString,
  thicknessInches: nullableDimString,
  volumeL: nullableDimString,
  finSetup: nullableDimString,
  finSystem: nullableDimString,
  construction: nullableDimString,
  confidence: z
    .object({
      length: fieldConfidenceSchema,
      widthInches: fieldConfidenceSchema,
      thicknessInches: fieldConfidenceSchema,
      volumeL: fieldConfidenceSchema,
      finSetup: fieldConfidenceSchema,
      finSystem: fieldConfidenceSchema,
      construction: fieldConfidenceSchema,
      brand: fieldConfidenceSchema,
    })
    .optional(),
  /** Catalog name or slug observed from logos/wordmarks. */
  brandHint: nullableDimString.optional(),
  /** Reserved — unused in merge for now. */
  modelHint: nullableDimString.optional(),
  rawText: z.preprocess((value) => {
    if (value == null) return undefined
    if (typeof value !== "string") return undefined
    return value.slice(0, 2000)
  }, z.string().max(2000).optional()),
})

export type ExtractListingFromPhotosModelOutput = z.infer<
  typeof extractListingFromPhotosModelOutputSchema
>

export const extractMatchedBrandSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(200),
  slug: z.string().min(1).max(200),
})

export type ExtractMatchedBrand = z.infer<typeof extractMatchedBrandSchema>

/** Normalized fields safe to merge into empty sell-form slots. */
export const extractListingFromPhotosNormalizedSchema = z.object({
  boardLength: z.string().nullable(),
  boardWidthInches: z.string().nullable(),
  boardThicknessInches: z.string().nullable(),
  boardVolumeL: z.string().nullable(),
  boardFins: z.string().nullable(),
  boardFinSystem: z.string().nullable(),
  boardConstruction: z.string().nullable(),
  fieldCount: z.number().int().min(0).max(8),
  brandHint: z.string().nullable(),
  matchedBrand: extractMatchedBrandSchema.nullable(),
  modelHint: z.string().nullable(),
})

export type ExtractListingFromPhotosNormalized = z.infer<
  typeof extractListingFromPhotosNormalizedSchema
>

export const EXTRACT_LISTING_FIN_SETUP_SLUGS = FIN_SETUP_SLUGS
export const EXTRACT_LISTING_FIN_SYSTEM_SLUGS = FIN_SYSTEM_SLUGS
export const EXTRACT_LISTING_CONSTRUCTION_SLUGS = CONSTRUCTION_SLUGS
export const EXTRACT_LISTING_MAX_IMAGE_URLS = 6
