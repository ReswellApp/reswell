import { z } from "zod"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

function refineHasLineRef(
  v: { order_item_id?: string; listing_id?: string },
  ctx: z.RefinementCtx,
) {
  if (!v.order_item_id && !v.listing_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "order_item_id or listing_id is required",
      path: ["listing_id"],
    })
  }
}

export const adminOrderItemReturnPostBodySchema = z.union([
  z
    .object({
      action: z.literal("rates"),
      order_item_id: z.string().uuid().optional(),
      listing_id: z.string().uuid().optional(),
      seller_address_id: z.string().uuid().optional(),
      parcel: shippingLabelParcelSchema.optional(),
    })
    .superRefine(refineHasLineRef),
  z
    .object({
      action: z.literal("purchase"),
      order_item_id: z.string().uuid().optional(),
      listing_id: z.string().uuid().optional(),
      seller_address_id: z.string().uuid().optional(),
      rate_id: z.string().min(5).max(128),
      parcel: shippingLabelParcelSchema.optional(),
    })
    .superRefine(refineHasLineRef),
])

export type AdminOrderItemReturnPostBody = z.infer<typeof adminOrderItemReturnPostBodySchema>
