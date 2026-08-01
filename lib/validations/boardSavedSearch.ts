import { z } from "zod"
import { PEER_LISTING_SECTIONS } from "@/lib/peer-listing-sections"

const boardsRadiusValues = z.enum(["25", "50", "100", "200"])

const facetSlugListSchema = z.array(z.string().trim().min(1).max(64)).max(20).optional()

const peerSectionSchema = z.enum(PEER_LISTING_SECTIONS)

/**
 * Stored criteria for saved searches / Klaviyo matching.
 * Shape mirrors browse params for the target section so alerts can replay the same search.
 * `location` / `lat` / `lng` / `radiusMi` are legacy-only and ignored for email alerts (nationwide).
 * Missing `section` defaults to surfboards for back-compat.
 */
export const boardSavedSearchCriteriaSchema = z.object({
  /** Peer marketplace section this saved search targets (`surfboards`, `fins`, …). */
  section: peerSectionSchema.optional(),
  /**
   * When true (marketplace `/search` with no section scope), match any peer listing section.
   */
  anySection: z.boolean().optional(),
  q: z.string().trim().max(500).optional(),
  brand: z.string().trim().max(200).optional(),
  brandId: z.string().trim().uuid().optional(),
  model: z.string().trim().max(200).optional(),
  brandModelId: z.string().trim().uuid().optional(),
  dimensions: z.string().trim().max(120).optional(),
  dimLength: z.string().trim().max(80).optional(),
  dimWidth: z.string().trim().max(80).optional(),
  dimThickness: z.string().trim().max(80).optional(),
  dimVolume: z.string().trim().max(48).optional(),
  /** Nav `type=` (single board style). Prefer `style` when multi-select facets were used. */
  type: z.string().trim().max(64).optional(),
  /** Legacy single / comma-joined condition; prefer `conditions` for multi-select. */
  condition: z.string().trim().max(200).optional(),
  conditions: facetSlugListSchema,
  style: facetSlugListSchema,
  fin: facetSlugListSchema,
  finSystem: facetSlugListSchema,
  construction: facetSlugListSchema,
  /** Length facet bucket slugs (e.g. `6-0-6-5`), not freeform dimLength. */
  length: facetSlugListSchema,
  /** Volume facet bucket slugs (e.g. `30-35`), not freeform dimVolume. */
  volume: facetSlugListSchema,
  /** Fin size / wetsuit size facet slugs. */
  sizes: facetSlugListSchema,
  /** Apparel category facet slugs (`boardshorts`, `hat`, `t_shirt`, `other`). */
  kind: facetSlugListSchema,
  /** Magazine year range. */
  minYear: z.number().int().min(1900).max(2100).optional(),
  maxYear: z.number().int().min(1900).max(2100).optional(),
  /** When true, only listings with seller shipping enabled. */
  shipping: z.boolean().optional(),
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

/** Max saved searches per account across all marketplace sections. */
export const BOARD_SAVED_SEARCHES_MAX = 3

export const deleteBoardSavedSearchActionSchema = z.object({
  id: z.string().trim().uuid(),
})

/** True when the saved snapshot narrows beyond an unfiltered category browse. */
export function boardSavedCriteriaHasSpecificity(c: BoardSavedSearchCriteria): boolean {
  if (c.q?.trim()) return true
  if (c.brand?.trim()) return true
  if (c.brandId?.trim()) return true
  if (c.model?.trim()) return true
  if (c.brandModelId?.trim()) return true
  if (c.dimensions?.trim()) return true
  if (c.dimLength?.trim()) return true
  if (c.dimWidth?.trim()) return true
  if (c.dimThickness?.trim()) return true
  if (c.dimVolume?.trim()) return true
  if (c.type && c.type !== "all") return true
  if (c.condition && c.condition !== "all") return true
  if (c.conditions && c.conditions.length > 0) return true
  if (c.style && c.style.length > 0) return true
  if (c.fin && c.fin.length > 0) return true
  if (c.finSystem && c.finSystem.length > 0) return true
  if (c.construction && c.construction.length > 0) return true
  if (c.length && c.length.length > 0) return true
  if (c.volume && c.volume.length > 0) return true
  if (c.sizes && c.sizes.length > 0) return true
  if (c.kind && c.kind.length > 0) return true
  if (c.minYear != null && Number.isFinite(c.minYear)) return true
  if (c.maxYear != null && Number.isFinite(c.maxYear)) return true
  if (c.shipping === true) return true
  if (c.minPrice != null && Number.isFinite(c.minPrice)) return true
  if (c.maxPrice != null && Number.isFinite(c.maxPrice)) return true
  return false
}

/**
 * Empty-state Save Search: allow saving a bare category (e.g. `/fins` with no filters)
 * so shoppers can get alerts for the whole section.
 */
export function boardSavedCriteriaCanSaveFromEmptyState(
  c: BoardSavedSearchCriteria,
): boolean {
  if (boardSavedCriteriaHasSpecificity(c)) return true
  if (c.anySection && c.q?.trim()) return true
  if (c.section && !c.anySection) return true
  return false
}
