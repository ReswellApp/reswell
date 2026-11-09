import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isInStockQuantitySale,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"

describe("isInStockQuantitySale", () => {
  it("keeps leftover stock on the sold feed for any condition", () => {
    assert.equal(
      isInStockQuantitySale({
        status: "active",
        stock_quantity: 19,
        title: "ELUDE 6ft Leash",
      }),
      true,
    )
    assert.equal(
      isListingVisibleInPublicSoldFeed({
        status: "active",
        stock_quantity: 3,
        title: "True Ames Greenough",
      }),
      true,
    )
    assert.equal(
      isListingVisibleInPublicSoldFeed({
        status: "sold",
        title: "Used Channel Islands",
      }),
      true,
    )
    assert.equal(
      isListingVisibleInPublicSoldFeed({
        status: "pending_sale",
        title: "6'0 JS Monsta",
      }),
      true,
    )
    assert.equal(
      isListingVisibleInPublicSoldFeed({
        status: "sold",
        hidden_from_site: true,
        title: "In-store Channel Islands",
      }),
      true,
    )
  })

  it("does not treat a relisted unique listing as leftover stock", () => {
    assert.equal(
      isInStockQuantitySale({
        status: "active",
        stock_quantity: 0,
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

  it("hides sold-out, hidden, and archived leftover-stock rows", () => {
    assert.equal(
      isInStockQuantitySale({
        status: "active",
        stock_quantity: 0,
      }),
      false,
    )
    assert.equal(
      isInStockQuantitySale({
        status: "sold",
        stock_quantity: 0,
      }),
      false,
    )
    assert.equal(
      isInStockQuantitySale({
        status: "active",
        stock_quantity: 4,
        hidden_from_site: true,
      }),
      false,
    )
    assert.equal(
      isInStockQuantitySale({
        status: "active",
        stock_quantity: 4,
        archived_at: "2026-10-22T00:00:00.000Z",
      }),
      false,
    )
  })
})
