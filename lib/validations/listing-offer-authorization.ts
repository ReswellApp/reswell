import { z } from "zod"

export const createListingOfferPaymentIntentBodySchema = z.object({
  amount: z.coerce.number().finite().positive(),
  fulfillment: z.enum(["pickup", "shipping"]),
  address_id: z.string().uuid().optional(),
  quote_token: z.string().trim().min(1).optional(),
})

export type CreateListingOfferPaymentIntentBody = z.infer<
  typeof createListingOfferPaymentIntentBodySchema
>
