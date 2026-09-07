import { z } from "zod"
import {
  MARKETPLACE_REVIEW_MAX_PHOTOS,
  marketplaceReviewAttachmentInputSchema,
} from "@/lib/validations/marketplace-review-attachment"

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
  attachments: z
    .array(marketplaceReviewAttachmentInputSchema)
    .max(MARKETPLACE_REVIEW_MAX_PHOTOS)
    .optional(),
})

export type OrderSellerReviewBody = z.infer<typeof orderSellerReviewBodySchema>
