import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addedToCartHeading,
  cartFromCartCheckoutHref,
  cartItemCountFromQuantities,
  shouldOpenAddedToCartDialog,
} from "./added-to-cart.ts"

describe("addedToCartHeading", () => {
  it("uses singular copy for one item", () => {
    assert.equal(addedToCartHeading(1), "Ok, 1 item was added to your cart. What's next?")
  })

  it("uses plural copy for multiple items", () => {
    assert.equal(addedToCartHeading(2), "Ok, 2 items were added to your cart. What's next?")
  })
})

describe("cartFromCartCheckoutHref", () => {
  it("builds checkout from the cart for a seller", () => {
    assert.equal(
      cartFromCartCheckoutHref("seller-1"),
      "/checkout?from_cart=1&seller_id=seller-1",
    )
  })
})

describe("shouldOpenAddedToCartDialog", () => {
  it("stays closed on cart and checkout", () => {
    assert.equal(shouldOpenAddedToCartDialog("/cart"), false)
    assert.equal(shouldOpenAddedToCartDialog("/checkout"), false)
    assert.equal(shouldOpenAddedToCartDialog("/checkout/success"), false)
  })

  it("opens on browse and listing pages", () => {
    assert.equal(shouldOpenAddedToCartDialog("/boards"), true)
    assert.equal(shouldOpenAddedToCartDialog("/l/some-board"), true)
  })
})

describe("cartItemCountFromQuantities", () => {
  it("sums line quantities", () => {
    assert.equal(cartItemCountFromQuantities([{ quantity: 1 }, { quantity: 3 }]), 4)
  })
})
