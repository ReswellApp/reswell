import { z } from "zod"

export const createListingOfferBodySchema = z.object({
  /** Buyer’s offer for the item (excluding shipping). */
  amount: z.coerce.number().finite().positive(),
  fulfillment: z.enum(["pickup", "shipping"]),
  message: z.string().trim().max(200).optional(),
  shipZip: z
    .string()
    .trim()
    .max(12)
    .optional()
    .transform((s) => (s === "" ? undefined : s)),
  shippingRegion: z.enum(["continental", "alaska_hawaii", "international"]).optional().default("continental"),
})

export type CreateListingOfferBody = z.infer<typeof createListingOfferBodySchema>
