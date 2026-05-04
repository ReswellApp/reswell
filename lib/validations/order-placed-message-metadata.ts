import { z } from "zod"

export const orderPlacedMessageMetadataSchema = z.object({
  kind: z.literal("order_placed"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1),
  listingTitle: z.string(),
  listingTitles: z.array(z.string()).optional(),
  listingIds: z.array(z.string().uuid()).optional(),
  total: z.number(),
  fulfillment: z.enum(["pickup", "shipping"]),
  paymentMethod: z.enum(["card", "reswell_bucks"]),
})

export type OrderPlacedMessagePayload = z.infer<typeof orderPlacedMessageMetadataSchema>

export function parseOrderPlacedMessageMetadata(
  metadata: unknown,
): OrderPlacedMessagePayload | null {
  const r = orderPlacedMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
