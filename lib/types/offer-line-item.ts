import { z } from "zod"

export const offerLineItemSchema = z.object({
  listing_id: z.string().uuid(),
  amount: z.number().finite().positive(),
  title: z.string().max(200).optional(),
})

export type OfferLineItem = z.infer<typeof offerLineItemSchema>

export const offerLineItemsSchema = z.array(offerLineItemSchema).min(1).max(20)

export function parseOfferLineItems(raw: unknown): OfferLineItem[] | null {
  const parsed = offerLineItemsSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

export function offerLineItemsSubtotal(items: OfferLineItem[]): number {
  return Math.round(items.reduce((sum, row) => sum + row.amount, 0) * 100) / 100
}

export function offerLineItemsListingIds(items: OfferLineItem[]): string[] {
  return items.map((row) => row.listing_id)
}
