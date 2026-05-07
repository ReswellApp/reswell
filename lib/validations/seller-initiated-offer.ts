import { z } from "zod"

export const sellerInitiatedOfferBodySchema = z.object({
  buyerUserId: z.string().uuid(),
  amount: z.coerce.number().positive().finite(),
  message: z.string().max(200).optional(),
})

export type SellerInitiatedOfferBody = z.infer<typeof sellerInitiatedOfferBodySchema>
