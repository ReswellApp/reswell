import { z } from "zod"

/** Normalizes a synonym term / query key the same way analytics + runtime matching does. */
export function normalizeSearchCurationKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 200)
}

const expansionTerm = z.string().trim().min(1).max(100)

export const createSearchSynonymSchema = z.object({
  term: z.string().trim().min(1).max(100),
  expansions: z.array(expansionTerm).min(1).max(15),
  enabled: z.boolean().optional().default(true),
})

export type CreateSearchSynonymInput = z.infer<typeof createSearchSynonymSchema>

export const updateSearchSynonymSchema = z
  .object({
    term: z.string().trim().min(1).max(100).optional(),
    expansions: z.array(expansionTerm).min(1).max(15).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.term !== undefined || v.expansions !== undefined || v.enabled !== undefined, {
    message: "Nothing to update",
  })

export type UpdateSearchSynonymInput = z.infer<typeof updateSearchSynonymSchema>

export const createSearchOverrideSchema = z.object({
  query: z.string().trim().min(1).max(200),
  note: z.string().trim().max(500).optional(),
  enabled: z.boolean().optional().default(true),
})

export type CreateSearchOverrideInput = z.infer<typeof createSearchOverrideSchema>

export const updateSearchOverrideSchema = z
  .object({
    note: z.string().trim().max(500).nullable().optional(),
    enabled: z.boolean().optional(),
  })
  .refine((v) => v.note !== undefined || v.enabled !== undefined, {
    message: "Nothing to update",
  })

export type UpdateSearchOverrideInput = z.infer<typeof updateSearchOverrideSchema>

export const addSearchOverrideListingSchema = z.object({
  listingId: z.string().trim().uuid(),
})

export const reorderSearchOverrideListingsSchema = z.object({
  rowIds: z.array(z.string().trim().uuid()).min(1).max(100),
})

export const searchCurationIdParamSchema = z.object({
  id: z.string().trim().uuid(),
})
