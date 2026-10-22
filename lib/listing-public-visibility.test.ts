import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isInStockBrandNewUnitSale,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"

describe("isInStockBrandNewUnitSale", () => {
  it("keeps a brand-new listing with stock on the sold feed", () => {
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "brand_new",
        stock_quantity: 19,
        title: "ELUDE 6ft Leash",
      }),
      true,
    )
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "new",
        stock_quantity: 1,
      }),
      true,
    )
  })

  it("does not treat a relisted used listing as a unit sale", () => {
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "excellent",
        stock_quantity: 1,
        title: "6'6 Channel Islands",
      }),
      false,
    )
    assert.equal(
      isListingVisibleInPublicSoldFeed({
        status: "active",
        title: "6'6 Channel Islands",
      }),
      false,
    )
  })

  it("hides sold-out, hidden, and archived brand-new rows", () => {
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "brand_new",
        stock_quantity: 0,
      }),
      false,
    )
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "sold",
        condition: "brand_new",
        stock_quantity: 0,
      }),
      false,
    )
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "brand_new",
        stock_quantity: 4,
        hidden_from_site: true,
      }),
      false,
    )
    assert.equal(
      isInStockBrandNewUnitSale({
        status: "active",
        condition: "brand_new",
        stock_quantity: 4,
        archived_at: "2026-10-22T00:00:00.000Z",
      }),
      false,
    )
  })
})
