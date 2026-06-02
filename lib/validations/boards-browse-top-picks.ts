import { z } from "zod"

export const adminBoardsBrowseTopPickListingBodySchema = z.object({
  listing_id: z.string().trim().uuid("listing_id must be a UUID"),
})

export const adminBoardsBrowseTopPickReorderBodySchema = z.object({
  ordered_row_ids: z.array(z.string().trim().uuid()).min(1),
})

export const adminBoardsBrowseTopPickSearchQuerySchema = z.object({
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
