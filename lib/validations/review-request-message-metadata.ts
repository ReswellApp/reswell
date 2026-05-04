import { z } from "zod"

export const reviewRequestMessageMetadataSchema = z.object({
  kind: z.literal("review_requested"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1),
  listingTitle: z.string(),
})

export type ReviewRequestMessagePayload = z.infer<typeof reviewRequestMessageMetadataSchema>

export function parseReviewRequestMessageMetadata(metadata: unknown): ReviewRequestMessagePayload | null {
  const r = reviewRequestMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
