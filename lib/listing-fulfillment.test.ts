import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardFulfillmentDetailLabels,
  flatShippingUsdForPublicListing,
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

describe("flatShippingUsdForPublicListing", () => {
  it("ignores a leftover flat amount after switching to Reswell calculated", () => {
    assert.equal(flatShippingUsdForPublicListing(45, "reswell"), 0)
  })

  it("ignores a leftover flat amount when shipping is free", () => {
    assert.equal(flatShippingUsdForPublicListing("12.50", "free"), 0)
  })

  it("keeps the seller flat rate", () => {
    assert.equal(flatShippingUsdForPublicListing("18.00", "flat"), 18)
  })

  it("keeps a legacy amount when the mode was never stored", () => {
    assert.equal(flatShippingUsdForPublicListing(25, null), 25)
  })
})

describe("boardFulfillmentDetailLabels", () => {
  it("describes Reswell shipping even when a previous flat price is still stored", () => {
    assert.deepEqual(boardFulfillmentDetailLabels(true, true, 40, "reswell"), [
      "Shipping calculated at checkout",
      "Local pickup",
    ])
  })

  it("describes a real flat rate", () => {
    assert.deepEqual(boardFulfillmentDetailLabels(false, true, 15, "flat"), [
      "Shipping (+$15.00)",
    ])
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
