import { z } from "zod"

export const createListingOfferBodySchema = z.object({
  /** Buyer’s offer for the item (excluding shipping). */
  amount: z.coerce.number().finite().positive(),
  /** Delivery choice from the listing — shipping cost is never negotiated. */
  fulfillment: z.enum(["pickup", "shipping"]),
  message: z.string().trim().max(200).optional(),
  /** Authorized (manual-capture) PaymentIntent reserved in the offer popup. */
  payment_intent_id: z.string().trim().min(1),
  /** Required when fulfillment is shipping. */
  address_id: z.string().uuid().optional(),
  /** Signed Reswell shipping quote when the listing uses calculated shipping. */
  quote_token: z.string().trim().min(1).optional(),
  /** Legacy fields — ignored. */
  shipZip: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  shippingRegion: z.enum(["continental", "alaska_hawaii", "international"]).optional(),
})

export type CreateListingOfferBody = z.infer<typeof createListingOfferBodySchema>
