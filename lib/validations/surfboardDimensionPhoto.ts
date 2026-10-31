import { z } from "zod"

export const SURFBOARD_DIMENSION_PHOTO_RATINGS = ["good", "close", "bad"] as const
export type SurfboardDimensionPhotoRating =
  (typeof SURFBOARD_DIMENSION_PHOTO_RATINGS)[number]

export const SURFBOARD_DIMENSION_PHOTO_SURFACES = [
  "admin_test",
  "sell_photo_match",
  "listing_scan",
] as const
export type SurfboardDimensionPhotoSurface =
  (typeof SURFBOARD_DIMENSION_PHOTO_SURFACES)[number]

export const SURFBOARD_DIMENSION_PHOTO_REF_SOURCES = [
  "listing_seed",
  "match_accepted",
  "manual",
  "listing_scan",
] as const
export type SurfboardDimensionPhotoRefSource =
  (typeof SURFBOARD_DIMENSION_PHOTO_REF_SOURCES)[number]

export const SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET = 0.9

/** Soft Jev post-vision verify payload persisted on match rows. */
export type SurfboardDimensionPhotoJevReview = {
  source: "jev" | "fallback"
  photoVerdict: "accept" | "reject" | null
  dimsVerdict: "good" | "close" | "bad" | null
  volumeNullProbability: number | null
  volumeCleared: boolean
  nextAction: "keep" | "clear_volume" | "retry_with_examples" | "distrust" | null
  retriedWithExamples: boolean
  reason: string
}

export const surfboardDimensionPhotoMatchListQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(30),
  rating: z
    .enum(["unrated", "good", "close", "bad", "excluded", "all"])
    .optional()
    .default("unrated"),
  surface: z
    .enum(["all", "admin_test", "sell_photo_match", "listing_scan"])
    .optional()
    .default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
})

export const surfboardDimensionPhotoRefListQuerySchema = z.object({
  q: z.string().trim().max(200).optional().default(""),
  active: z
    .enum(["1", "0", "true", "false", "all"])
    .optional()
    .default("1")
    .transform((v) => {
      if (v === "all") return "all" as const
      if (v === "0" || v === "false") return false
      return true
    }),
  limit: z.coerce.number().int().min(1).max(200).optional().default(60),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
})

const ratingField = z.enum(SURFBOARD_DIMENSION_PHOTO_RATINGS).nullable().optional()

export const rateSurfboardDimensionPhotoMatchSchema = z
  .object({
    /** @deprecated Prefer photoRating + dimsRating. Kept for back-compat. */
    matchRating: ratingField,
    photoRating: ratingField,
    dimsRating: ratingField,
    note: z.string().trim().max(1000).nullable().optional(),
    /** Skip this case forever for rematch/scan; stores exclude memory. */
    excluded: z.boolean().optional(),
    promoteToRefs: z.boolean().optional().default(true),
  })
  .refine(
    (v) =>
      v.matchRating !== undefined ||
      v.photoRating !== undefined ||
      v.dimsRating !== undefined ||
      v.note !== undefined ||
      v.excluded !== undefined,
    { message: "Nothing to update" },
  )

export const surfboardDimensionPhotoMatchIdParamSchema = z.object({
  id: z.string().trim().uuid(),
})

export const surfboardDimensionPhotoRefIdParamSchema = z.object({
  id: z.string().trim().uuid(),
})

export const patchSurfboardDimensionPhotoRefSchema = z.object({
  active: z.boolean().optional(),
  boardLength: z.string().trim().min(1).max(32).optional(),
  boardWidthInches: z.string().trim().min(1).max(32).optional(),
  boardThicknessInches: z.string().trim().min(1).max(32).optional(),
  boardVolumeL: z.string().trim().max(32).nullable().optional(),
})

export const seedSurfboardDimensionPhotoRefsSchema = z.object({
  /** Listings to vision-scan per Sync click (each listing = one Gateway call). */
  limit: z.coerce.number().int().min(1).max(40).optional().default(12),
})

export const rematchSurfboardDimensionPhotoSchema = z.object({
  /** Bad/Close matches to rematch per click (each = one new match row). */
  limit: z.coerce.number().int().min(1).max(40).optional().default(12),
})
