import { z } from "zod"

export const withdrawOfferSchema = z.object({
  offerId: z.string().uuid(),
})

export type WithdrawOfferInput = z.infer<typeof withdrawOfferSchema>
