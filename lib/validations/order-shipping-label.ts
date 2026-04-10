import { z } from "zod"

export const shippingLabelParcelSchema = z.object({
  length_in: z.coerce.number().min(6).max(120),
  width_in: z.coerce.number().min(4).max(48),
  height_in: z.coerce.number().min(2).max(36),
  weight_lb: z.coerce.number().min(1).max(80),
})

export const shippingLabelRatesBodySchema = z.object({
  action: z.literal("rates"),
  seller_address_id: z.string().uuid(),
  parcel: shippingLabelParcelSchema,
})

export const shippingLabelPurchaseBodySchema = z.object({
  action: z.literal("purchase"),
  /** ShipEngine `rate_id` from the rates response. */
  rate_id: z.string().min(5).max(128),
})

export const shippingLabelPostBodySchema = z.discriminatedUnion("action", [
  shippingLabelRatesBodySchema,
  shippingLabelPurchaseBodySchema,
])

export type ShippingLabelPostBody = z.infer<typeof shippingLabelPostBodySchema>
