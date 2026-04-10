import { z } from "zod"

export const stripeConnectCashOutBodySchema = z.object({
  amount: z.coerce.number().finite().min(10, "Minimum payout amount is $10.00"),
})

export type StripeConnectCashOutBody = z.infer<typeof stripeConnectCashOutBodySchema>
