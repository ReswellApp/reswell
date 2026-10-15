import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isShippableSurfboardListing } from "./shippable-surfboard.ts"

describe("isShippableSurfboardListing", () => {
  it("accepts surfboards with shipping on", () => {
    assert.equal(
      isShippableSurfboardListing({ section: "surfboards", shipping_available: true }),
      true,
    )
  })

  it("rejects pickup-only boards, other sections, and unset shipping", () => {
    assert.equal(
      isShippableSurfboardListing({ section: "surfboards", shipping_available: false }),
      false,
    )
    assert.equal(
      isShippableSurfboardListing({ section: "surfboards", shipping_available: null }),
      false,
    )
    assert.equal(
      isShippableSurfboardListing({ section: "fins", shipping_available: true }),
      false,
    )
  })
})
