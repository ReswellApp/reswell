import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listingMarkSoldAlreadyComplete } from "@/lib/listing-mark-sold-request"

describe("listingMarkSoldAlreadyComplete", () => {
  it("treats an already-sold listing as finished", () => {
    assert.equal(
      listingMarkSoldAlreadyComplete({
        ok: false,
        error: "Listing is already sold",
        status: 400,
      }),
      true,
    )
  })

  it("does not swallow other mark-sold failures", () => {
    assert.equal(
      listingMarkSoldAlreadyComplete({
        ok: false,
        error: "Failed to mark listing as sold",
        status: 500,
      }),
      false,
    )
    assert.equal(
      listingMarkSoldAlreadyComplete({ ok: true, priceUsd: 400 }),
      false,
    )
  })
})
