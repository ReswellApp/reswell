import assert from "node:assert/strict"
import test from "node:test"
import { shopifyConnectErrorMessage } from "@/lib/shopify/connect-errors"
import { resolveShopifyManualSetupState } from "@/lib/services/shopifyAccess"

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

test("manual setup needs both the env flag and the profile allowlist", () => {
  assert.equal(
    resolveShopifyManualSetupState({ envEnabled: false, profileAllowlisted: true }),
    "disabled",
  )
  assert.equal(
    resolveShopifyManualSetupState({ envEnabled: true, profileAllowlisted: false }),
    "needs_approval",
  )
  assert.equal(
    resolveShopifyManualSetupState({ envEnabled: true, profileAllowlisted: true }),
    "available",
  )
})
