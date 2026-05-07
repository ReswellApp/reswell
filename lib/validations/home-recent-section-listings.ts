import { z } from "zod"

export const adminHomeRecentSectionParamSchema = z.enum(["recent-surfboards", "recent-shortboards"])

export type AdminHomeRecentSectionParam = z.infer<typeof adminHomeRecentSectionParamSchema>

export function homeRecentSectionKeyFromParam(
  param: AdminHomeRecentSectionParam,
): "recent_surfboards" | "recent_shortboards" {
  return param === "recent-surfboards" ? "recent_surfboards" : "recent_shortboards"
}

export const adminHomeRecentSectionListingBodySchema = z.object({
  listing_id: z.string().trim().uuid("listing_id must be a UUID"),
})

export const adminHomeRecentSectionReorderBodySchema = z.object({
  ordered_row_ids: z.array(z.string().trim().uuid()).min(1),
})

export const adminHomeRecentSectionSearchQuerySchema = z.object({
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
