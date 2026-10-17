import assert from "node:assert/strict"
import test from "node:test"
import { shopifyConnectErrorMessage } from "@/lib/shopify/connect-errors"

test("maps connect failure details to merchant-facing messages", () => {
  assert.match(shopifyConnectErrorMessage("invalid_shop"), /myshopify\.com/)
  assert.match(shopifyConnectErrorMessage("invalid_state"), /expired/)
  assert.match(shopifyConnectErrorMessage("already_linked"), /different Shopify store/)
  assert.match(shopifyConnectErrorMessage("store_taken"), /different Reswell account/)
})

test("falls back to a generic message for unknown details", () => {
  const generic = shopifyConnectErrorMessage(undefined)
  assert.equal(shopifyConnectErrorMessage("toString"), generic)
  assert.equal(shopifyConnectErrorMessage("<script>"), generic)
})
