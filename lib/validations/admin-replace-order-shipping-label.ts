import { z } from "zod"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

export const adminReplaceOrderShippingLabelPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rates"),
    parcel: shippingLabelParcelSchema,
    /** Seller address when available; otherwise an admin ship-from address. */
    ship_from_address_id: z.string().uuid().optional(),
  }),
  z.object({
    action: z.literal("purchase"),
    parcel: shippingLabelParcelSchema,
    rate_id: z.string().min(5).max(128),
    /** Seller address when available; otherwise an admin ship-from address. */
    ship_from_address_id: z.string().uuid().optional(),
  }),
])

export type AdminReplaceOrderShippingLabelPostBody = z.infer<
  typeof adminReplaceOrderShippingLabelPostBodySchema
>
