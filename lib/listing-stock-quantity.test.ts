import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  brandNewQuantityValidationMessage,
  clampListingBuyerQuantity,
  listingBuyerQuantityCap,
  listingSupportsBuyerQuantity,
  parseBrandNewListingQuantity,
  peerBrandNewStockQuantity,
  sellFormStockQuantityValue,
  stockQuantityForSellCondition,
} from "@/lib/listing-stock-quantity"

describe("stockQuantityForSellCondition", () => {
  it("stores the seller quantity for brand new listings", () => {
    assert.equal(stockQuantityForSellCondition("brand_new", "4"), 4)
    assert.equal(stockQuantityForSellCondition("new", 2), 2)
  })

  it("keeps used listings as a single unique item", () => {
    assert.equal(stockQuantityForSellCondition("excellent", "4"), 0)
    assert.equal(stockQuantityForSellCondition("good", ""), 0)
  })

  it("falls back to one unit when a brand-new quantity is blank", () => {
    assert.equal(stockQuantityForSellCondition("brand_new", ""), 1)
  })
})

describe("parseBrandNewListingQuantity", () => {
  it("rejects decimals and out-of-range values", () => {
    assert.equal(parseBrandNewListingQuantity("1.5"), null)
    assert.equal(parseBrandNewListingQuantity("0"), null)
    assert.equal(parseBrandNewListingQuantity("1000"), null)
    assert.equal(brandNewQuantityValidationMessage("brand_new", "0"), "Enter a quantity between 1 and 999.")
    assert.equal(brandNewQuantityValidationMessage("excellent", "0"), null)
  })
})

describe("listing buyer quantity", () => {
  it("caps brand-new peer stock and leaves legacy rows at one", () => {
    const brandNew = {
      section: "fins",
      condition: "brand_new",
      stock_quantity: 6,
    }
    assert.equal(peerBrandNewStockQuantity(brandNew), 6)
    assert.equal(listingBuyerQuantityCap(brandNew), 6)
    assert.equal(listingSupportsBuyerQuantity(brandNew), true)
    assert.equal(clampListingBuyerQuantity(brandNew, 9), 6)

    const legacy = { section: "fins", condition: "brand_new", stock_quantity: 0 }
    assert.equal(peerBrandNewStockQuantity(legacy), 0)
    assert.equal(listingBuyerQuantityCap(legacy), 1)
    assert.equal(listingSupportsBuyerQuantity(legacy), false)
  })

  it("does not open quantity on used or Shopify rows", () => {
    assert.equal(
      listingBuyerQuantityCap({ section: "fins", condition: "excellent", stock_quantity: 4 }),
      1,
    )
    assert.equal(
      listingSupportsBuyerQuantity({
        section: "fins",
        condition: "brand_new",
        stock_quantity: 4,
        inventory_source: "shopify",
      }),
      false,
    )
  })

  it("keeps Reswell shop stock as the cap", () => {
    assert.equal(
      listingBuyerQuantityCap({ section: "new", condition: "brand_new", stock_quantity: 3 }),
      3,
    )
    assert.equal(sellFormStockQuantityValue(0), "1")
    assert.equal(sellFormStockQuantityValue(12), "12")
  })
})
