import { createHash } from "node:crypto"

import { listingQuantitiesKey } from "@/lib/stripe/checkout-quantities-key"

/**
 * Identity of one checkout attempt: the cart (listings, quantities, offer).
 * Destination, promo, and charged amount are NOT part of the fingerprint —
 * those update the existing PaymentIntent instead of opening a second charge.
 */
export function checkoutSessionFingerprint(input: {
  listingIds: readonly string[]
  quantities: Record<string, number>
  offerId?: string | null
}): string {
  const listingKey = [...input.listingIds]
    .map((id) => id.trim())
    .filter(Boolean)
    .sort()
    .join(",")
  const material = [
    listingKey,
    listingQuantitiesKey(input.quantities),
    input.offerId?.trim() || "",
  ].join("|")
  return createHash("sha256").update(material).digest("hex")
}

export function checkoutListingSetsOverlap(
  left: readonly string[],
  right: readonly string[],
): boolean {
  const set = new Set(left.map((id) => id.trim()).filter(Boolean))
  if (set.size === 0) return false
  return right.some((id) => set.has(id.trim()))
}

export const CHECKOUT_SESSION_TTL_MS = 6 * 60 * 60 * 1000
