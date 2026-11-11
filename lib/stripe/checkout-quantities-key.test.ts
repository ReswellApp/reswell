import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listingQuantitiesKey } from "@/lib/stripe/checkout-quantities-key"

describe("listingQuantitiesKey", () => {
  it("is stable across object identity and key order", () => {
    const a = { "b-id": 2, "a-id": 1 }
    const b = { "a-id": 1, "b-id": 2 }
    assert.equal(listingQuantitiesKey(a), listingQuantitiesKey(b))
    assert.equal(listingQuantitiesKey(a), "a-id:1,b-id:2")
  })

  it("treats missing quantities as empty", () => {
    assert.equal(listingQuantitiesKey(undefined), "")
    assert.equal(listingQuantitiesKey(null), "")
  })
})
