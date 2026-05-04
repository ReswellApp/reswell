import type Stripe from "stripe"

/** Dedupe UUIDs while preserving first occurrence order (matches checkout payload order). */
export function dedupeIdsPreserveOrder(ids: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of ids) {
    const id = raw.trim()
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
  }
  return out
}

export function marketplaceListingIdsFromPaymentIntent(pi: Stripe.PaymentIntent): string[] {
  const csv = pi.metadata?.listing_ids?.trim()
  if (csv) {
    return dedupeIdsPreserveOrder(csv.split(","))
  }
  const one = pi.metadata?.listing_id?.trim()
  return one ? [one] : []
}
