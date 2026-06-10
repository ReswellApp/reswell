import { z } from "zod"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

export const sellerShippingLabelPaymentIntentBodySchema = z.object({
  rate_id: z.string().min(5).max(128),
  seller_address_id: z.string().uuid().optional(),
  parcel: shippingLabelParcelSchema.optional(),
})

export const sellerShippingLabelFinalizeBodySchema = z.object({
  payment_intent_id: z.string().min(5).max(128),
})
