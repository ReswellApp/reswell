import assert from "node:assert/strict"
import test from "node:test"
import { EMPTY_SHOP_SHIPPING_DEFAULTS, SHOP_STORE_DEFAULT_ID } from "@/lib/shop-shipping-defaults"
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

test("uses a surfboard shop default before an older category preset", () => {
  const defaults = shopifyImportFulfillmentDefaults({
    section: "surfboards",
    hasShipFromAddress: true,
    packageSizes: { surfboards: "longboard" },
    shippingDefaults: {
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      storeDefault: {
        id: SHOP_STORE_DEFAULT_ID,
        name: "Shortboard · Compact",
        lengthIn: 72,
        widthIn: 22,
        heightIn: 5,
        weightLb: 14,
        presetId: "shortboard_compact",
      },
    },
  })
  assert.equal(defaults.shipping_available, true)
  assert.equal(defaults.shipping_package_band, "shortboard_compact")
})

test("keeps a category preset for soft goods when one is already saved", () => {
  const defaults = shopifyImportFulfillmentDefaults({
    section: "fins",
    hasShipFromAddress: true,
    packageSizes: { fins: "large" },
    shippingDefaults: {
      ...EMPTY_SHOP_SHIPPING_DEFAULTS,
      storeDefault: {
        id: SHOP_STORE_DEFAULT_ID,
        name: "Small",
        lengthIn: 12,
        widthIn: 10,
        heightIn: 4,
        weightLb: 2,
        presetId: "small",
      },
    },
  })
  assert.equal(defaults.shipping_packed_length_in, 36)
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
