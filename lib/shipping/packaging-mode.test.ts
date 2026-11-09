import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  checkoutOffersShippingPackagingChoice,
  resolveMultiItemPackagingMode,
} from "./packaging-mode.ts"

function boards(count: number, shipping = true) {
  return Array.from({ length: count }, () => ({
    section: "surfboards",
    shipping_available: shipping,
  }))
}

describe("resolveMultiItemPackagingMode", () => {
  it("lets two or three surfboards ship together or separately", () => {
    const two = boards(2)
    assert.equal(checkoutOffersShippingPackagingChoice(two), true)
    assert.equal(
      resolveMultiItemPackagingMode({ listings: two, requested: "together", fulfillment: "shipping" }),
      "together",
    )
    assert.equal(
      resolveMultiItemPackagingMode({ listings: two, requested: "separate", fulfillment: "shipping" }),
      "separate",
    )
    assert.equal(checkoutOffersShippingPackagingChoice(boards(3)), true)
  })

  it("ships four or more surfboards as separate packages", () => {
    const four = boards(4)
    assert.equal(checkoutOffersShippingPackagingChoice(four), false)
    assert.equal(
      resolveMultiItemPackagingMode({ listings: four, requested: "together", fulfillment: "shipping" }),
      "separate",
    )
    assert.equal(
      resolveMultiItemPackagingMode({ listings: four, requested: "separate", fulfillment: "shipping" }),
      "separate",
    )
  })

  it("keeps local pickup on the default packaging mode", () => {
    assert.equal(
      resolveMultiItemPackagingMode({
        listings: boards(4),
        requested: "separate",
        fulfillment: "pickup",
      }),
      "together",
    )
  })
})
