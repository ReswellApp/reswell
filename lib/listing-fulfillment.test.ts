import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingPickupCaption,
  listingShippingCaptionForPdp,
} from "./listing-fulfillment.ts"

describe("listingPickupCaption", () => {
  it("returns null when pickup is not offered", () => {
    assert.equal(listingPickupCaption(false, "Santa Barbara, CA"), null)
  })

  it("includes the city when the listing has a location", () => {
    assert.equal(
      listingPickupCaption(true, "Santa Barbara, CA"),
      "Local pickup in Santa Barbara, CA",
    )
  })

  it("falls back to Local pickup without a location", () => {
    assert.equal(listingPickupCaption(true, "  "), "Local pickup")
  })
})

describe("listingShippingCaptionForPdp", () => {
  it("returns null when shipping is not offered", () => {
    assert.equal(
      listingShippingCaptionForPdp(false, "Shipping calculated at checkout"),
      null,
    )
  })

  it("drops pickup-only captions so pickup can render on its own row", () => {
    assert.equal(
      listingShippingCaptionForPdp(true, "Local pickup · shipping not offered"),
      null,
    )
  })

  it("keeps a real shipping caption", () => {
    assert.equal(
      listingShippingCaptionForPdp(true, "Shipping rate calculated at checkout"),
      "Shipping rate calculated at checkout",
    )
  })
})
