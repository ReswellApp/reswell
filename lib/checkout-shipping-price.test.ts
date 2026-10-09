import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCheckoutShippingPriceDisplay } from "./checkout-shipping-price.ts"

describe("checkout shipping price display", () => {
  it("shows a flat rate before an address is saved", () => {
    const display = resolveCheckoutShippingPriceDisplay({
      needsShipping: true,
      priceDependsOnAddress: false,
      hasShippingAddress: false,
      quoteLoading: false,
      quoteError: null,
      shippingUsd: 45,
    })
    assert.equal(display.status, "priced")
    assert.equal(display.label, "$45.00")
    assert.equal(display.amountUsd, 45)
  })

  it("shows free seller shipping without an address", () => {
    const display = resolveCheckoutShippingPriceDisplay({
      needsShipping: true,
      priceDependsOnAddress: false,
      hasShippingAddress: false,
      quoteLoading: false,
      quoteError: null,
      shippingUsd: 0,
    })
    assert.equal(display.status, "free")
    assert.equal(display.amountUsd, 0)
  })

  it("hides calculated shipping until a destination exists", () => {
    const display = resolveCheckoutShippingPriceDisplay({
      needsShipping: true,
      priceDependsOnAddress: true,
      hasShippingAddress: false,
      quoteLoading: false,
      quoteError: null,
      shippingUsd: 0,
    })
    assert.equal(display.status, "pending")
    assert.equal(display.amountUsd, null)
  })

  it("shows the calculated carrier rate once the address is saved", () => {
    const display = resolveCheckoutShippingPriceDisplay({
      needsShipping: true,
      priceDependsOnAddress: true,
      hasShippingAddress: true,
      quoteLoading: false,
      quoteError: null,
      shippingUsd: 82.4,
    })
    assert.equal(display.status, "priced")
    assert.equal(display.label, "$82.40")
    assert.equal(display.amountUsd, 82.4)
  })

  it("does not call a missing calculated quote free", () => {
    const display = resolveCheckoutShippingPriceDisplay({
      needsShipping: true,
      priceDependsOnAddress: true,
      hasShippingAddress: true,
      quoteLoading: true,
      quoteError: null,
      shippingUsd: null,
    })
    assert.equal(display.status, "calculating")
    assert.equal(display.amountUsd, null)
  })
})
