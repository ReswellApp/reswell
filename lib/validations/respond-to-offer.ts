import { z } from "zod"

export const respondToOfferSchema = z
  .object({
    offerId: z.string().uuid(),
    action: z.enum(["accept", "decline", "counter"]),
    counterAmount: z.coerce.number().optional(),
    counterNote: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.action === "counter") {
      const n = data.counterAmount
      if (n === undefined || Number.isNaN(n) || n <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a counter amount.",
          path: ["counterAmount"],
        })
      }
    }
  })

export type RespondToOfferInput = z.infer<typeof respondToOfferSchema>
