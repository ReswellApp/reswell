import { z } from "zod"

export const orderShippedMessageMetadataSchema = z.object({
  kind: z.literal("order_shipped"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1).optional(),
  listingTitle: z.string().optional(),
  trackingNumber: z.string().optional(),
  trackingCarrier: z.string().nullable().optional(),
})

export type OrderShippedMessagePayload = z.infer<typeof orderShippedMessageMetadataSchema>

export function parseOrderShippedMessageMetadata(
  metadata: unknown,
): OrderShippedMessagePayload | null {
  const r = orderShippedMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
