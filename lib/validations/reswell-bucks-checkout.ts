import { z } from "zod"

export const reswellBucksCheckoutSchema = z.object({
  idempotency_key: z.string().uuid(),
  listing_id: z.string().uuid().optional(),
  listing_ids: z.array(z.string().uuid()).max(20).optional(),
  fulfillment: z.enum(["pickup", "shipping"]).nullable().optional(),
  address_id: z.string().uuid().nullable().optional(),
  offer_id: z.string().uuid().nullable().optional(),
  promo_code: z.string().trim().max(64).nullable().optional(),
  quote_token: z.string().max(8000).nullable().optional(),
  packaging_mode: z.enum(["together", "separate"]).nullable().optional(),
  surfboard_shipped: z.boolean().optional(),
})

export type ReswellBucksCheckoutInput = z.infer<typeof reswellBucksCheckoutSchema>
