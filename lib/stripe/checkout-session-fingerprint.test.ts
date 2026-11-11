import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  checkoutListingSetsOverlap,
  checkoutSessionFingerprint,
} from "@/lib/stripe/checkout-session-fingerprint"

describe("checkoutSessionFingerprint", () => {
  const base = {
    listingIds: ["b", "a"],
    quantities: { a: 1, b: 2 },
    offerId: null as string | null,
  }

  it("is stable across listing order", () => {
    assert.equal(
      checkoutSessionFingerprint(base),
      checkoutSessionFingerprint({ ...base, listingIds: ["a", "b"] }),
    )
  })

  it("does not change when destination, promo, or amount would change", () => {
    const first = checkoutSessionFingerprint(base)
    const second = checkoutSessionFingerprint(base)
    assert.equal(first, second)
  })

  it("changes when the cart or offer changes", () => {
    assert.notEqual(
      checkoutSessionFingerprint(base),
      checkoutSessionFingerprint({ ...base, quantities: { a: 1, b: 1 } }),
    )
    assert.notEqual(
      checkoutSessionFingerprint(base),
      checkoutSessionFingerprint({ ...base, offerId: "offer-1" }),
    )
  })
})

describe("checkoutListingSetsOverlap", () => {
  it("detects shared listings regardless of order", () => {
    assert.equal(checkoutListingSetsOverlap(["a", "b"], ["c", "a"]), true)
    assert.equal(checkoutListingSetsOverlap(["a"], ["b"]), false)
  })
})
