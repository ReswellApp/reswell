import { z } from "zod"

export const orderRefundedMessageMetadataSchema = z.object({
  kind: z.literal("order_refunded"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1),
  listingTitle: z.string(),
  listingTitles: z.array(z.string()).optional(),
})

export type OrderRefundedMessagePayload = z.infer<typeof orderRefundedMessageMetadataSchema>

export function parseOrderRefundedMessageMetadata(
  metadata: unknown,
): OrderRefundedMessagePayload | null {
  const r = orderRefundedMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
