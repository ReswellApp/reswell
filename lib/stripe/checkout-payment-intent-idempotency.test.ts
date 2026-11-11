import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { checkoutPaymentIntentIdempotencyKey } from "@/lib/stripe/checkout-payment-intent-idempotency"

describe("checkoutPaymentIntentIdempotencyKey", () => {
  const base = {
    buyerId: "buyer-1",
    listingIds: ["listing-b", "listing-a"],
    quantities: { "listing-a": 1, "listing-b": 1 },
    amountCents: 6792,
    addressId: "addr-1",
    fulfillment: "shipping" as const,
    nowMs: 1_762_525_000_000,
  }

  it("is stable for the same checkout parameters", () => {
    assert.equal(
      checkoutPaymentIntentIdempotencyKey(base),
      checkoutPaymentIntentIdempotencyKey({
        ...base,
        listingIds: ["listing-a", "listing-b"],
      }),
    )
  })

  it("changes when the amount changes", () => {
    assert.notEqual(
      checkoutPaymentIntentIdempotencyKey(base),
      checkoutPaymentIntentIdempotencyKey({ ...base, amountCents: 6800 }),
    )
  })
})
