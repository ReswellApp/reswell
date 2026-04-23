import { z } from "zod"

export const stripeConnectCashOutBodySchema = z.object({
  amount: z.coerce.number().finite().min(10, "Minimum payout amount is $10.00"),
  speed: z.enum(["standard", "instant"]).default("standard"),
  /** When set, this bank becomes the default payout destination for this cash-out (and until changed). */
  externalAccountId: z
    .string()
    .trim()
    .regex(/^ba_/, "Invalid bank account id")
    .optional(),
})

export type StripeConnectCashOutBody = z.infer<typeof stripeConnectCashOutBodySchema>

export const stripeConnectExternalAccountBodySchema = z.object({
  externalAccountId: z.string().trim().regex(/^ba_/, "Invalid bank account id"),
})

export type StripeConnectExternalAccountBody = z.infer<
  typeof stripeConnectExternalAccountBodySchema
>
