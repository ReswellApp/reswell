import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { coalesceReswellRateShipFrom } from "./reswell-rate-ship-from.ts"

const listingAddr = { zip: "92024", line: "100 Main St" }
const sellerAddr = { zip: "93101", line: "12 Hidden Cove Rd" }
const listingMissing = {
  ok: false as const,
  error: "Seller location is missing — shipping cannot be calculated.",
}

describe("coalesceReswellRateShipFrom", () => {
  it("uses the seller ship-from when it exists, even if the listing has a pin", () => {
    const result = coalesceReswellRateShipFrom({
      sellerShipFromAddress: sellerAddr,
      listingShipFrom: { ok: true, address: listingAddr },
    })
    assert.equal(result.ok, true)
    if (result.ok) {
      assert.equal(result.address.zip, "93101")
      assert.equal(result.address.line, "12 Hidden Cove Rd")
    }
  })

  it("uses listing city/state when the seller has no ship-from", () => {
    const result = coalesceReswellRateShipFrom({
      sellerShipFromAddress: null,
      listingShipFrom: { ok: true, address: listingAddr },
    })
    assert.equal(result.ok, true)
    if (result.ok) assert.equal(result.address.zip, "92024")
  })

  it("still errors when neither ship-from nor listing locality exists", () => {
    const result = coalesceReswellRateShipFrom({
      sellerShipFromAddress: null,
      listingShipFrom: listingMissing,
    })
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.match(result.error, /Seller location is missing/)
    }
  })
})
