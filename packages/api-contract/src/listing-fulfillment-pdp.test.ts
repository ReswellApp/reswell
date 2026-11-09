import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingFulfillmentPdpCopy } from "./listing-fulfillment-pdp.ts"

describe("listingFulfillmentPdpCopy", () => {
  it("combines shipping and pickup into one headline and subline", () => {
    assert.deepEqual(
      listingFulfillmentPdpCopy({
        pickupOffered: true,
        shippingOffered: true,
        locationLine: "SANTA BARBARA, CALIFORNIA",
        shippingLine: "Shipping calculated at checkout",
      }),
      {
        headline: "Shipping and local pickup available",
        subline: "SANTA BARBARA, CALIFORNIA · Shipping calculated at checkout",
      },
    )
  })

  it("handles pickup only", () => {
    assert.deepEqual(
      listingFulfillmentPdpCopy({
        pickupOffered: true,
        shippingOffered: false,
        locationLine: "Oceanside, CA",
      }),
      {
        headline: "Local pickup available",
        subline: "Oceanside, CA",
      },
    )
  })

  it("handles shipping only with mode fallback", () => {
    assert.deepEqual(
      listingFulfillmentPdpCopy({
        pickupOffered: false,
        shippingOffered: true,
        shippingCostMode: "free",
      }),
      {
        headline: "Shipping available",
        subline: "Free shipping at checkout",
      },
    )
  })
})
