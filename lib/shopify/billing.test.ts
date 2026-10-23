import assert from "node:assert/strict"
import test from "node:test"
import {
  connectedSalePayout,
  isReswellOriginatedShopifyOrder,
  shopifyCatalogSyncAllowed,
  shopifyCollectVia,
  shopifyManagedListingSaleAllowed,
  shopifySaleIdempotencyKey,
} from "@/lib/shopify/billing"

test("a connected sale charges 7% once through Shopify", () => {
  const billed = connectedSalePayout(100, { feeWaived: true, shopifyBilled: true })
  assert.equal(billed.platformFee, 0)
  assert.equal(billed.sellerEarnings, 100)
  assert.equal(billed.shopifyUsageFee, 7)

  const stripe = connectedSalePayout(100, { feeWaived: false, shopifyBilled: false })
  assert.equal(stripe.platformFee, 7)
  assert.equal(stripe.sellerEarnings, 93)
  assert.equal(stripe.shopifyUsageFee, 0)

  const waived = connectedSalePayout(100, { feeWaived: true, shopifyBilled: false })
  assert.equal(waived.platformFee, 0)
  assert.equal(waived.sellerEarnings, 100)
  assert.equal(waived.shopifyUsageFee, 0)
})

test("sale idempotency key is the Reswell order id", () => {
  assert.equal(
    shopifySaleIdempotencyKey("8f1c2a40-1b2c-4d5e-9f00-aabbccddeeff"),
    "8f1c2a40-1b2c-4d5e-9f00-aabbccddeeff",
  )
})

test("Reswell-created Shopify orders are skipped on the way back", () => {
  assert.equal(isReswellOriginatedShopifyOrder({ tags: "Reswell, paid" }), true)
  assert.equal(
    isReswellOriginatedShopifyOrder({ note: "Reswell order abc" }),
    true,
  )
  assert.equal(
    isReswellOriginatedShopifyOrder({
      noteAttributes: [{ name: "reswell_order_id", value: "abc" }],
    }),
    true,
  )
  assert.equal(
    isReswellOriginatedShopifyOrder({
      tags: "online",
      note: "customer checkout",
      noteAttributes: [{ name: "source", value: "web" }],
    }),
    false,
  )
})

test("a Shopify listing is for sale only while billing is active", () => {
  assert.equal(
    shopifyManagedListingSaleAllowed({
      inventorySource: "shopify",
      billingStatus: "active",
    }),
    true,
  )
  for (const billingStatus of ["pending", "declined", "paused", null, undefined]) {
    assert.equal(
      shopifyManagedListingSaleAllowed({
        inventorySource: "shopify",
        billingStatus,
      }),
      false,
    )
  }
  assert.equal(
    shopifyManagedListingSaleAllowed({
      inventorySource: "reswell",
      billingStatus: "declined",
    }),
    true,
  )
  assert.equal(
    shopifyManagedListingSaleAllowed({
      inventorySource: null,
      billingStatus: "pending",
    }),
    true,
  )
})

test("catalog sync stays off until the usage charge is approved", () => {
  assert.equal(
    shopifyCatalogSyncAllowed({
      status: "active",
      sync_enabled: true,
      billing_status: "pending",
    }),
    false,
  )
  assert.equal(
    shopifyCatalogSyncAllowed({
      status: "active",
      sync_enabled: true,
      billing_status: "active",
    }),
    true,
  )
  assert.equal(shopifyCollectVia("active"), "shopify")
  assert.equal(shopifyCollectVia("declined"), "stripe")
  assert.equal(shopifyCollectVia("pending"), "stripe")
})
