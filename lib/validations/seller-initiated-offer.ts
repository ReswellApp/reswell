import { z } from "zod"

export const sellerOfferLineItemInputSchema = z.object({
  listingId: z.string().uuid(),
  amount: z.coerce.number().positive().finite(),
})

export const sellerInitiatedOfferBodySchema = z
  .object({
    buyerUserId: z.string().uuid(),
    fulfillment: z.enum(["pickup", "shipping"]),
    shippingAmount: z.coerce.number().finite().min(0).optional(),
    lineItems: z.array(sellerOfferLineItemInputSchema).min(1).max(20).optional(),
    /** Legacy single-item clients may send amount instead of lineItems. */
    amount: z.coerce.number().positive().finite().optional(),
    message: z.string().max(200).optional(),
  })
  .superRefine((data, ctx) => {
    const hasLineItems = Array.isArray(data.lineItems) && data.lineItems.length > 0
    if (!hasLineItems && data.amount == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide at least one line item or an amount.",
        path: ["lineItems"],
      })
    }
    if (hasLineItems) {
      const ids = data.lineItems!.map((row) => row.listingId)
      if (new Set(ids).size !== ids.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Each listing can only appear once in the offer.",
          path: ["lineItems"],
        })
      }
    }
    if (data.fulfillment === "shipping" && data.shippingAmount == null && !hasLineItems && data.amount != null) {
      // Single-item legacy path may omit shippingAmount; service defaults from listing.
      return
    }
  })

export type SellerInitiatedOfferBody = z.infer<typeof sellerInitiatedOfferBodySchema>

export type NormalizedSellerOfferLineItem = {
  listingId: string
  amount: number
}

export function normalizeSellerOfferLineItems(
  body: SellerInitiatedOfferBody,
  anchorListingId: string,
): NormalizedSellerOfferLineItem[] {
  if (Array.isArray(body.lineItems) && body.lineItems.length > 0) {
    return body.lineItems.map((row) => ({
      listingId: row.listingId,
      amount: Math.round(row.amount * 100) / 100,
    }))
  }
  if (body.amount != null) {
    return [
      {
        listingId: anchorListingId,
        amount: Math.round(body.amount * 100) / 100,
      },
    ]
  }
  return []
}
