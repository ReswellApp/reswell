import type { SupabaseClient } from "@supabase/supabase-js"
import { surfboardOfferAmountError } from "@/lib/listing-price-bounds"
import type { OfferLineItem } from "@/lib/types/offer-line-item"

/**
 * Blocks accepting or checking out a surfboard negotiation under $50.
 * Single-item offers use `amount`. Bundles check each surfboard line.
 */
export async function surfboardNegotiatedPriceError(
  supabase: SupabaseClient,
  input: {
    section: string | null | undefined
    amount: number
    lineItems: OfferLineItem[] | null
  },
): Promise<string | null> {
  if (input.lineItems && input.lineItems.length > 0) {
    const ids = [...new Set(input.lineItems.map((row) => row.listing_id))]
    const { data, error } = await supabase.from("listings").select("id, section").in("id", ids)
    if (error || !data) return "Could not verify the surfboard price."
    const sectionById = new Map(
      (data as { id: string; section: string | null }[]).map((row) => [row.id, row.section]),
    )
    for (const line of input.lineItems) {
      const lineError = surfboardOfferAmountError(
        line.amount,
        sectionById.get(line.listing_id) ?? null,
      )
      if (lineError) return lineError
    }
    return null
  }
  return surfboardOfferAmountError(input.amount, input.section)
}
