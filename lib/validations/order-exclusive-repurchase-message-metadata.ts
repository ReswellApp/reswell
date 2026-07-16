import { z } from "zod"

export const orderExclusiveRepurchaseMessageMetadataSchema = z.object({
  kind: z.literal("order_exclusive_repurchase"),
  orderId: z.string().uuid(),
  orderNum: z.string().min(1),
  listingId: z.string().uuid(),
  listingTitle: z.string(),
  listingTitles: z.array(z.string()).optional(),
  listingSlug: z.string().nullable().optional(),
  listingSection: z.string().optional(),
  exclusiveUntil: z.string().min(1),
})

export type OrderExclusiveRepurchaseMessagePayload = z.infer<
  typeof orderExclusiveRepurchaseMessageMetadataSchema
>

export function parseOrderExclusiveRepurchaseMessageMetadata(
  metadata: unknown,
): OrderExclusiveRepurchaseMessagePayload | null {
  const r = orderExclusiveRepurchaseMessageMetadataSchema.safeParse(metadata)
  return r.success ? r.data : null
}
