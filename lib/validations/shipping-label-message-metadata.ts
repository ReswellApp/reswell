import { z } from "zod"

const shippingLabelFields = {
  orderId: z.string().uuid(),
  orderNum: z.string().min(1).optional(),
  listingTitle: z.string().optional(),
  trackingNumber: z.string().nullable().optional(),
  trackingCarrier: z.string().nullable().optional(),
  labelPdfUrl: z.string().nullable().optional(),
  hasPaperlessQr: z.boolean().optional(),
}

export const shippingLabelReadyMessageMetadataSchema = z.object({
  kind: z.literal("shipping_label_ready"),
  ...shippingLabelFields,
})

export const adminShippingLabelMessageMetadataSchema = z.object({
  kind: z.literal("admin_shipping_label"),
  ...shippingLabelFields,
})

export type ShippingLabelReadyMessagePayload = z.infer<
  typeof shippingLabelReadyMessageMetadataSchema
>
export type AdminShippingLabelMessagePayload = z.infer<
  typeof adminShippingLabelMessageMetadataSchema
>

export type ShippingLabelMessagePayload =
  | ShippingLabelReadyMessagePayload
  | AdminShippingLabelMessagePayload

export function parseShippingLabelMessageMetadata(
  metadata: unknown,
): ShippingLabelMessagePayload | null {
  const ready = shippingLabelReadyMessageMetadataSchema.safeParse(metadata)
  if (ready.success) return ready.data
  const admin = adminShippingLabelMessageMetadataSchema.safeParse(metadata)
  return admin.success ? admin.data : null
}
