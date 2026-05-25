import { z } from "zod"

export const orderShippedMessageMetadataSchema = z.object({
  kind: z.literal("order_shipped"),
  orderId: z.string().uuid(),
})

export type OrderShippedMessagePayload = z.infer<typeof orderShippedMessageMetadataSchema>

export function parseOrderShippedMessageMetadata(
  metadata: unknown,
): OrderShippedMessagePayload | null {
  const r = orderShippedMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
