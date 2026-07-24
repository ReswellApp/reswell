import { z } from "zod"

export const buyerZoneShippingEstimateSchema = z.object({
  /** Seller ship-from ZIP (5-digit US). */
  originZip: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "Enter a 5-digit US ZIP code"),
  tierId: z.enum(["shortboard", "midlength", "longboard"]),
  /** Shortboard pack band — ignored for mid/long. */
  packBandId: z
    .enum(["shortboard_compact", "shortboard_standard", "shortboard_max"])
    .optional()
    .nullable(),
  zone: z.enum(["california", "west", "rest_of_us", "hawaii"]),
})

export type BuyerZoneShippingEstimateInput = z.infer<
  typeof buyerZoneShippingEstimateSchema
>
