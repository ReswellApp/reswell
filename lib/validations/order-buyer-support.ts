import { z } from "zod"

const bodyField = z
  .string()
  .min(10, "Please add a bit more detail (at least 10 characters).")
  .max(8000)

export const orderBuyerSupportRequestSchema = z.discriminatedUnion("request_type", [
  z.object({
    request_type: z.literal("help"),
    body: bodyField,
  }),
  z.object({
    request_type: z.literal("cancel_order"),
    body: bodyField,
  }),
  z.object({
    request_type: z.literal("refund_help"),
    body: bodyField,
    contacted_seller_first: z.boolean({
      required_error: "Let us know whether you’ve already messaged the seller.",
    }),
  }),
])

export type OrderBuyerSupportRequestInput = z.infer<typeof orderBuyerSupportRequestSchema>
