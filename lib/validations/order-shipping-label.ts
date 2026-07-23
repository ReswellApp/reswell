import { z } from "zod"
import {
  LABEL_PARCEL_MIN_HEIGHT_IN,
  LABEL_PARCEL_MIN_LENGTH_IN,
  LABEL_PARCEL_MIN_WEIGHT_LB,
  LABEL_PARCEL_MIN_WIDTH_IN,
  SURFBOARD_LABEL_MAX_HEIGHT_IN,
  SURFBOARD_LABEL_MAX_LENGTH_IN,
  SURFBOARD_LABEL_MAX_WEIGHT_LB,
  SURFBOARD_LABEL_MAX_WIDTH_IN,
  validateLabelParcelEntry,
} from "@/lib/shipping/surfboard-label-limits"

/** Packed carton the seller will ship — category-agnostic (fins, boards, accessories). */
export const shippingLabelParcelSchema = z
  .object({
    length_in: z.coerce.number().min(LABEL_PARCEL_MIN_LENGTH_IN).max(SURFBOARD_LABEL_MAX_LENGTH_IN),
    width_in: z.coerce.number().min(LABEL_PARCEL_MIN_WIDTH_IN).max(SURFBOARD_LABEL_MAX_WIDTH_IN),
    height_in: z.coerce.number().min(LABEL_PARCEL_MIN_HEIGHT_IN).max(SURFBOARD_LABEL_MAX_HEIGHT_IN),
    weight_lb: z.coerce.number().min(LABEL_PARCEL_MIN_WEIGHT_LB).max(SURFBOARD_LABEL_MAX_WEIGHT_LB),
  })
  .superRefine((data, ctx) => {
    const check = validateLabelParcelEntry({
      lengthIn: data.length_in,
      widthIn: data.width_in,
      heightIn: data.height_in,
      weightLb: data.weight_lb,
    })
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.error,
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
  z.object({
    order_id: z.string().uuid(),
    action: z.literal("purchase_seller_wallet"),
    rate_id: z.string().min(5).max(128),
    seller_address_id: z.string().uuid().optional(),
    parcel: shippingLabelParcelSchema.optional(),
  }),
])

export type AdminOrderShippingLabelPostBody = z.infer<typeof adminOrderShippingLabelPostBodySchema>
