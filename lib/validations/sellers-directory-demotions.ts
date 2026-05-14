import { z } from "zod"

export const adminSellersDirectoryDemotionBodySchema = z.object({
  profile_id: z.string().trim().uuid("profile_id must be a UUID"),
})

export type AdminSellersDirectoryDemotionBody = z.infer<
  typeof adminSellersDirectoryDemotionBodySchema
>

export const adminSellersDirectoryDemotionSearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(120),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => {
      if (v == null || v === "") return 200
      const n = typeof v === "number" ? v : Number(v)
      if (!Number.isFinite(n)) return 200
      return Math.min(Math.max(Math.trunc(n), 1), 500)
    }),
})
