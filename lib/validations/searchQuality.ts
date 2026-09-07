import { z } from "zod"
import { normalizeSearchCurationKey } from "@/lib/validations/searchCuration"

export const SEARCH_QUALITY_RATINGS = ["good", "close", "bad"] as const
export type SearchQualityRating = (typeof SEARCH_QUALITY_RATINGS)[number]

export const SEARCH_QUALITY_SURFACES = ["marketplace", "boards"] as const
export type SearchQualitySurface = (typeof SEARCH_QUALITY_SURFACES)[number]

export const SEARCH_QUALITY_MATCH_TARGET = 0.95

export const searchQualityListQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).optional().default(14),
  rating: z.enum(["unrated", "good", "close", "bad", "all"]).optional().default("all"),
  q: z.string().trim().max(200).optional().default(""),
  llmOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(40),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
})

export const rateSearchQualityEventSchema = z
  .object({
    resultRating: z.enum(SEARCH_QUALITY_RATINGS).nullable().optional(),
    llmRating: z.enum(SEARCH_QUALITY_RATINGS).nullable().optional(),
    listingId: z.string().trim().uuid().optional(),
    listingRating: z.enum(SEARCH_QUALITY_RATINGS).nullable().optional(),
    note: z.string().trim().max(1000).nullable().optional(),
  })
  .refine(
    (v) =>
      v.resultRating !== undefined ||
      v.llmRating !== undefined ||
      v.note !== undefined ||
      (v.listingId !== undefined && v.listingRating !== undefined),
    { message: "Nothing to update" },
  )

export const searchQualityEventIdParamSchema = z.object({
  id: z.string().trim().uuid(),
})

export function normalizeSearchQualityQuery(raw: string): string {
  return normalizeSearchCurationKey(raw)
}
