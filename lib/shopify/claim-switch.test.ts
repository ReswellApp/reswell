import assert from "node:assert/strict"
import test from "node:test"
import { shopifyClaimShouldReviveInventory } from "@/lib/shopify/claim-switch"

test("moving to any other shop does not revive the previous store", () => {
  for (const [previous, claimed] of [
    ["old-store.myshopify.com", "new-store.myshopify.com"],
    ["alpha.myshopify.com", "beta.myshopify.com"],
  ]) {
    assert.equal(shopifyClaimShouldReviveInventory(previous, claimed), false)
  }
})

test("reclaiming the same shop still revives inventory jobs", () => {
  assert.equal(
    shopifyClaimShouldReviveInventory(
      "Old-Store.myshopify.com",
      "old-store.myshopify.com",
    ),
    true,
  )
})

test("the first Shopify claim has no previous listings to revive", () => {
  assert.equal(
    shopifyClaimShouldReviveInventory(null, "new-store.myshopify.com"),
    true,
  )
})
