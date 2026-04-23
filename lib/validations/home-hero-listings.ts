import { z } from "zod"

export const adminHomeHeroListingBodySchema = z.object({
  listing_id: z.string().trim().uuid("listing_id must be a UUID"),
})

export type AdminHomeHeroListingBody = z.infer<typeof adminHomeHeroListingBodySchema>

export const adminHomeHeroListingSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 20
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 20
      return Math.min(Math.max(Math.trunc(n), 1), 50)
    }),
})
