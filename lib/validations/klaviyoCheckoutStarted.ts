import { z } from "zod"

export const klaviyoCheckoutStartedBodySchema = z
  .object({
    from_cart: z.boolean().optional(),
    seller_id: z.string().uuid().optional(),
    listing: z.string().min(1).max(256).optional(),
  })
  .refine(
    (body) =>
      body.from_cart === true ||
      Boolean(body.listing?.trim()),
    "Provide from_cart or listing",
  )

export type KlaviyoCheckoutStartedBody = z.infer<
  typeof klaviyoCheckoutStartedBodySchema
>
