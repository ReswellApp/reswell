import { z } from "zod"

const boardsRadiusValues = z.enum(["25", "50", "100", "200"])

/** Stored criteria for saved searches / Klaviyo matching. `location` / `lat` / `lng` / `radiusMi` are legacy-only and ignored when matching listings for email alerts (nationwide). */
export const boardSavedSearchCriteriaSchema = z.object({
  q: z.string().trim().max(500).optional(),
  brand: z.string().trim().max(200).optional(),
  brandId: z.string().trim().uuid().optional(),
  model: z.string().trim().max(200).optional(),
  brandModelId: z.string().trim().uuid().optional(),
  dimensions: z.string().trim().max(120).optional(),
  type: z.string().trim().max(64).optional(),
  condition: z.string().trim().max(64).optional(),
  sort: z.string().trim().max(64).optional(),
  minPrice: z.number().min(0).max(1_000_000).optional(),
  maxPrice: z.number().min(0).max(1_000_000).optional(),
  location: z.string().trim().max(300).optional(),
  radiusMi: boardsRadiusValues.optional(),
  lat: z.number().gte(-90).lte(90).optional(),
  lng: z.number().gte(-180).lte(180).optional(),
})

export type BoardSavedSearchCriteria = z.infer<typeof boardSavedSearchCriteriaSchema>

export const createBoardSavedSearchActionSchema = z.object({
  criteria: boardSavedSearchCriteriaSchema,
  emailNotificationsEnabled: z.boolean(),
  label: z.string().trim().max(120).optional(),
})

export type CreateBoardSavedSearchActionInput = z.infer<
  typeof createBoardSavedSearchActionSchema
>

/** True when the saved snapshot narrows beyond “all surfboards”. */
export function boardSavedCriteriaHasSpecificity(c: BoardSavedSearchCriteria): boolean {
  if (c.q?.trim()) return true
  if (c.brand?.trim()) return true
  if (c.brandId?.trim()) return true
  if (c.model?.trim()) return true
  if (c.brandModelId?.trim()) return true
  if (c.dimensions?.trim()) return true
  if (c.type && c.type !== "all") return true
  if (c.condition && c.condition !== "all") return true
  if (c.minPrice != null && Number.isFinite(c.minPrice)) return true
  if (c.maxPrice != null && Number.isFinite(c.maxPrice)) return true
  return false
}
