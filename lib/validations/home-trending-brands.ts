import { z } from "zod"

export const adminHomeTrendingBrandBodySchema = z.object({
  brand_id: z.string().trim().uuid("brand_id must be a UUID"),
})

export type AdminHomeTrendingBrandBody = z.infer<typeof adminHomeTrendingBrandBodySchema>

export const adminHomeTrendingBrandSearchQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 200
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 200
      // Server only applies this when `q` is set; “browse all” path ignores it.
      return Math.min(Math.max(Math.trunc(n), 1), 500)
    }),
})
