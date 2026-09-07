import { z } from "zod"

export const MARKETPLACE_REVIEW_ATTACHMENTS_BUCKET = "marketplace-review-attachments"

export const MARKETPLACE_REVIEW_MAX_PHOTOS = 5

export const marketplaceReviewImageAttachmentSchema = z.object({
  kind: z.literal("image"),
  bucket: z.string().min(1),
  path: z.string().min(1),
  file_name: z.string().min(1).max(500),
  mime_type: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
  size_bytes: z.number().int().positive(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
})

export const marketplaceReviewAttachmentInputSchema = marketplaceReviewImageAttachmentSchema.omit({
  bucket: true,
})

export const marketplaceReviewAttachmentsMetadataSchema = z.object({
  attachments: z
    .array(marketplaceReviewImageAttachmentSchema)
    .min(1)
    .max(MARKETPLACE_REVIEW_MAX_PHOTOS),
})

export type MarketplaceReviewImageAttachment = z.infer<typeof marketplaceReviewImageAttachmentSchema>
export type MarketplaceReviewAttachmentInput = z.infer<typeof marketplaceReviewAttachmentInputSchema>

export function parseMarketplaceReviewImageAttachments(
  metadata: unknown,
): MarketplaceReviewImageAttachment[] {
  if (!metadata || typeof metadata !== "object") return []
  const parsed = marketplaceReviewAttachmentsMetadataSchema.safeParse(metadata)
  return parsed.success ? parsed.data.attachments : []
}
