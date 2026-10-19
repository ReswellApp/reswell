import assert from "node:assert/strict"
import test from "node:test"

import {
  listingQuantityForCondition,
  listingScarcityCopy,
  listingStoredQuantity,
  listingUnitSaleEndsListing,
  peerBrandNewUnitsRemaining,
} from "@/lib/listing-quantity"

test("used listings always persist as a single unit", () => {
  assert.equal(listingQuantityForCondition("excellent", 12), 1)
  assert.equal(listingQuantityForCondition("good", ""), 1)
  assert.equal(listingQuantityForCondition(null, 4), 1)
})

test("stored quantity keeps zero after a sold-out brand-new sale", () => {
  assert.equal(listingStoredQuantity(0), 0)
  assert.equal(listingStoredQuantity("0"), 0)
  assert.equal(listingStoredQuantity(4.2), 4)
  assert.equal(listingStoredQuantity(null), 1)
  assert.equal(listingStoredQuantity(""), 1)
})

test("brand new listings keep any whole quantity of at least 1", () => {
  assert.equal(listingQuantityForCondition("brand_new", 1), 1)
  assert.equal(listingQuantityForCondition("brand_new", 40), 40)
  assert.equal(listingQuantityForCondition("brand_new", "8"), 8)
  assert.equal(listingQuantityForCondition("brand_new", 8.9), 8)
  assert.equal(listingQuantityForCondition("brand_new", 0), 1)
  assert.equal(listingQuantityForCondition("brand_new", ""), 1)
})

test("scarcity names the remaining count at 5 or below for brand new", () => {
  assert.deepEqual(listingScarcityCopy("brand_new", 5), {
    title: "Limited quantity only",
    detail: "5 left",
  })
  assert.deepEqual(listingScarcityCopy("brand_new", 1), {
    title: "Limited quantity only",
    detail: "1 left",
  })
  assert.equal(listingScarcityCopy("brand_new", 6), null)
})

test("used listings keep the single-item scarcity line", () => {
  assert.deepEqual(listingScarcityCopy("very_good", 1), {
    title: "Only one available",
    detail: "— grab it before it's gone",
  })
})

test("a brand-new sale ends the listing only on the last unit", () => {
  assert.equal(listingUnitSaleEndsListing({ condition: "brand_new", quantity: 4 }), false)
  assert.equal(listingUnitSaleEndsListing({ condition: "brand_new", quantity: 1 }), true)
  assert.equal(listingUnitSaleEndsListing({ condition: "good", quantity: 1 }), true)
})

test("purchase checks only apply when a brand-new quantity is present", () => {
  assert.equal(peerBrandNewUnitsRemaining({ condition: "excellent", quantity: 1 }), null)
  assert.equal(peerBrandNewUnitsRemaining({ condition: "brand_new", quantity: null }), null)
  assert.equal(peerBrandNewUnitsRemaining({ condition: "brand_new", quantity: 0 }), 0)
  assert.equal(peerBrandNewUnitsRemaining({ condition: "brand_new", quantity: 3 }), 3)
})
