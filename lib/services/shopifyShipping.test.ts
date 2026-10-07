import assert from "node:assert/strict"
import test from "node:test"
import { shopifyImportFulfillmentDefaults } from "@/lib/services/shopifyShipping"

test("keeps Shopify imports pickup-only without a package default", () => {
  const defaults = shopifyImportFulfillmentDefaults({
    section: "surfboards",
    hasShipFromAddress: true,
    packageSizes: {},
  })
  assert.equal(defaults.local_pickup, true)
  assert.equal(defaults.shipping_available, false)
  assert.equal(defaults.board_shipping_cost_mode, null)
})

test("keeps package data but disables shipping until ship-from is ready", () => {
  const defaults = shopifyImportFulfillmentDefaults({
    section: "surfboards",
    hasShipFromAddress: false,
    packageSizes: { surfboards: "shortboard_compact" },
  })
  assert.equal(defaults.shipping_available, false)
  assert.equal(defaults.shipping_package_tier, "shortboard")
  assert.equal(defaults.shipping_package_band, "shortboard_compact")
})

test("enables live Reswell shipping when address and package are ready", () => {
  const defaults = shopifyImportFulfillmentDefaults({
    section: "accessories",
    hasShipFromAddress: true,
    packageSizes: { accessories: "medium" },
  })
  assert.equal(defaults.local_pickup, true)
  assert.equal(defaults.shipping_available, true)
  assert.equal(defaults.board_shipping_cost_mode, "reswell")
  assert.equal(defaults.shipping_packed_length_in, 18)
  assert.equal(defaults.shipping_packed_weight_oz, 48)
})
