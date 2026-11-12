import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { effectiveBoardShippingMode } from "./board-shipping-cost-mode.ts"

describe("effectiveBoardShippingMode", () => {
  it("uses the saved board shipping mode when set", () => {
    assert.equal(effectiveBoardShippingMode({ board_shipping_cost_mode: "free" }), "free")
    assert.equal(effectiveBoardShippingMode({ board_shipping_cost_mode: "flat" }), "flat")
    assert.equal(effectiveBoardShippingMode({ board_shipping_cost_mode: "reswell" }), "reswell")
  })

  it("treats a positive shipping_price as flat when mode is missing", () => {
    assert.equal(effectiveBoardShippingMode({ shipping_price: "40" }), "flat")
    assert.equal(effectiveBoardShippingMode({ shipping_price: 0 }), "reswell")
    assert.equal(effectiveBoardShippingMode({}), "reswell")
  })

  it("forces apparel onto Reswell-calculated shipping", () => {
    assert.equal(
      effectiveBoardShippingMode({
        section: "apparel",
        board_shipping_cost_mode: "flat",
        shipping_price: "12",
      }),
      "reswell",
    )
  })
})
