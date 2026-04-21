import { z } from "zod"

export const orderSellerReviewBodySchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z
    .union([z.string().max(2000), z.null()])
    .optional()
    .transform((s) => {
      if (s == null || s === "") return undefined
      const t = s.trim()
      return t.length > 0 ? t : undefined
    }),
})

export type OrderSellerReviewBody = z.infer<typeof orderSellerReviewBodySchema>
