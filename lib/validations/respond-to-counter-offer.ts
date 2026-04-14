import { z } from "zod"

export const respondToCounterOfferSchema = z.object({
  offerId: z.string().uuid(),
  action: z.enum(["accept", "decline"]),
})

export type RespondToCounterOfferInput = z.infer<typeof respondToCounterOfferSchema>
