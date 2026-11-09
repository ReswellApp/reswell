import assert from "node:assert/strict"
import test from "node:test"
import { shopifyAvailableInventory } from "@/lib/shopify/catalog"
import { isShopifyManagedListing } from "@/lib/shopify/listing"

test("sums non-negative available inventory across Shopify locations", () => {
  assert.equal(
    shopifyAvailableInventory([
      { locationId: "one", locationName: "Store", available: 3 },
      { locationId: "two", locationName: "Warehouse", available: 4 },
      { locationId: "three", locationName: "Damaged", available: -2 },
    ]),
    7,
  )
})

test("recognizes only explicitly Shopify-managed listings", () => {
  assert.equal(isShopifyManagedListing({ inventory_source: "shopify" }), true)
  assert.equal(isShopifyManagedListing({ inventory_source: "reswell" }), false)
  assert.equal(isShopifyManagedListing({}), false)
})
