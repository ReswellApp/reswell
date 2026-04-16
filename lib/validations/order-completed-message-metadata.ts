import { z } from "zod"

export const orderCompletedMessageMetadataSchema = z.object({
  kind: z.literal("order_completed"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1),
  listingTitle: z.string(),
})

export type OrderCompletedMessagePayload = z.infer<typeof orderCompletedMessageMetadataSchema>

export function parseOrderCompletedMessageMetadata(
  metadata: unknown,
): OrderCompletedMessagePayload | null {
  const r = orderCompletedMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
