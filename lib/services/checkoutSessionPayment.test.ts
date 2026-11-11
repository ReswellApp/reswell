import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { listingIsUniqueCheckoutItem } from "@/lib/services/checkoutSessionPayment"

describe("listingIsUniqueCheckoutItem", () => {
  it("treats shop and brand-new stock as quantity, everything else as unique", () => {
    assert.equal(
      listingIsUniqueCheckoutItem({ id: "shop", section: "new", stock_quantity: 8 }),
      false,
    )
    assert.equal(
      listingIsUniqueCheckoutItem({
        id: "peer-new",
        section: "fins",
        condition: "brand_new",
        stock_quantity: 4,
      }),
      false,
    )
    assert.equal(
      listingIsUniqueCheckoutItem({
        id: "used",
        section: "fins",
        condition: "used",
        stock_quantity: 0,
      }),
      true,
    )
  })
})
