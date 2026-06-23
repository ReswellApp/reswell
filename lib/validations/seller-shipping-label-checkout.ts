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

export const sellerShippingLabelWalletBodySchema = sellerShippingLabelPaymentIntentBodySchema.extend({
  /** When false, only apply buyer prepaid shipping on the order (no wallet debit). Default true. */
  apply_wallet: z.boolean().optional(),
})
