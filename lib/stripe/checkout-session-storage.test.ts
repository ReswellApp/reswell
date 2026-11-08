import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { checkoutSessionStorageKey } from "@/lib/stripe/checkout-session-storage"

describe("checkoutSessionStorageKey", () => {
  it("changes when the cart or offer changes", () => {
    const base = {
      listingIdsKey: "a|b",
      quantitiesKey: "a:1,b:1",
      offerId: null as string | null,
    }
    assert.equal(checkoutSessionStorageKey(base), checkoutSessionStorageKey({ ...base }))
    assert.notEqual(
      checkoutSessionStorageKey(base),
      checkoutSessionStorageKey({ ...base, offerId: "offer-1" }),
    )
    assert.notEqual(
      checkoutSessionStorageKey(base),
      checkoutSessionStorageKey({ ...base, quantitiesKey: "a:2,b:1" }),
    )
  })
})
