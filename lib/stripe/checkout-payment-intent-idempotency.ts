import { createHash } from "node:crypto"

import { listingQuantitiesKey } from "@/lib/stripe/checkout-quantities-key"

/** Aligns with the recent-order duplicate window so retries reuse one PaymentIntent. */
export const CHECKOUT_PAYMENT_INTENT_IDEMPOTENCY_BUCKET_MS = 6 * 60 * 60 * 1000

export function checkoutPaymentIntentIdempotencyKey(input: {
  buyerId: string
  listingIds: readonly string[]
  quantities: Record<string, number>
  amountCents: number
  addressId?: string | null
  fulfillment: string
  promoCodeId?: string | null
  nowMs?: number
}): string {
  const listingKey = [...input.listingIds].map((id) => id.trim()).filter(Boolean).sort().join(",")
  const bucket = Math.floor(
    (input.nowMs ?? Date.now()) / CHECKOUT_PAYMENT_INTENT_IDEMPOTENCY_BUCKET_MS,
  )
  const material = [
    input.buyerId.trim(),
    listingKey,
    listingQuantitiesKey(input.quantities),
    String(input.amountCents),
    input.addressId?.trim() || "",
    input.fulfillment,
    input.promoCodeId?.trim() || "",
    String(bucket),
  ].join("|")
  const hash = createHash("sha256").update(material).digest("hex").slice(0, 40)
  return `checkout_pi_${hash}`
}
