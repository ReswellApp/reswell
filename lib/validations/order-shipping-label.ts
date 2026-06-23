import { z } from "zod"
import {
  SURFBOARD_LABEL_LIMITS_ERROR,
  SURFBOARD_LABEL_MAX_LENGTH_IN,
  SURFBOARD_LABEL_MAX_WEIGHT_LB,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"

export const shippingLabelParcelSchema = z
  .object({
    length_in: z.coerce.number().min(6).max(SURFBOARD_LABEL_MAX_LENGTH_IN),
    width_in: z.coerce.number().min(4).max(48),
    height_in: z.coerce.number().min(2).max(36),
    weight_lb: z.coerce.number().min(1).max(SURFBOARD_LABEL_MAX_WEIGHT_LB),
  })
  .superRefine((data, ctx) => {
    const check = validateSurfboardLabelParcelLimits({
      lengthIn: data.length_in,
      weightLb: data.weight_lb,
    })
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: SURFBOARD_LABEL_LIMITS_ERROR,
        path: ["length_in"],
      })
    }
  })

/** When `seller_address_id` or `parcel` is omitted, the server uses the seller default address and listing packed dimensions. */
export const shippingLabelRatesBodySchema = z.object({
  action: z.literal("rates"),
  seller_address_id: z.string().uuid().optional(),
  parcel: shippingLabelParcelSchema.optional(),
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

/** Admin ShipEngine label tool: same actions as seller, plus `order_id` (any marketplace order). */
export const adminOrderShippingLabelPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    order_id: z.string().uuid(),
    action: z.literal("purchase_checkout_lane"),
  }),
  z.object({
    order_id: z.string().uuid(),
    action: z.literal("rates"),
    seller_address_id: z.string().uuid().optional(),
    parcel: shippingLabelParcelSchema.optional(),
  }),
  z.object({
    order_id: z.string().uuid(),
    action: z.literal("purchase"),
    rate_id: z.string().min(5).max(128),
  }),
])

export type AdminOrderShippingLabelPostBody = z.infer<typeof adminOrderShippingLabelPostBodySchema>
