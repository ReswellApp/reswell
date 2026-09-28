import { z } from "zod"
import { adminUserShippingLabelShipToSchema } from "@/lib/validations/adminUserShippingLabel"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

const adminReplaceLabelAddressSchema = adminUserShippingLabelShipToSchema

export const adminReplaceOrderShippingLabelPostBodySchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("rates"),
    parcel: shippingLabelParcelSchema,
    /** Seller address when available; otherwise an admin ship-from address. */
    ship_from_address_id: z.string().uuid().optional(),
    /** Edited origin printed on the replacement label. */
    ship_from: adminReplaceLabelAddressSchema.optional(),
    /** Edited buyer destination. Saved on the order when the new label is purchased. */
    ship_to: adminReplaceLabelAddressSchema.optional(),
  }),
  z.object({
    action: z.literal("purchase"),
    parcel: shippingLabelParcelSchema,
    rate_id: z.string().min(5).max(128),
    /** Seller address when available; otherwise an admin ship-from address. */
    ship_from_address_id: z.string().uuid().optional(),
    /** Edited origin printed on the replacement label. */
    ship_from: adminReplaceLabelAddressSchema.optional(),
    /** Edited buyer destination. Saved on the order when the new label is purchased. */
    ship_to: adminReplaceLabelAddressSchema.optional(),
  }),
])

export type AdminReplaceOrderShippingLabelPostBody = z.infer<
  typeof adminReplaceOrderShippingLabelPostBodySchema
>
