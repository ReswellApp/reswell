import assert from "node:assert/strict"
import test from "node:test"
import {
  shopifyConnectErrorMessage,
  shopifyDashboardCallbackError,
  shopifyOAuthCallbackOutcome,
} from "@/lib/shopify/connect-errors"

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

const LINKED = {
  status: "active",
  last_webhook_at: "2026-10-12T03:30:00.000Z",
  last_reconciled_at: "2026-10-19T18:00:00.000Z",
}

test("an orders webhook rejection does not finish as a failed link", () => {
  const outcome = shopifyOAuthCallbackOutcome(
    "This app is not approved to subscribe to webhook topics containing protected customer data.",
  )
  assert.deepEqual(outcome, { connected: true })
  assert.equal(
    shopifyDashboardCallbackError({
      errorFlag: "1",
      detail: "connection_failed",
      connection: { ...LINKED, status: "error" },
      catalogTotal: 4,
    }),
    null,
  )
})

test("a real link failure still shows when the store is not already linked", () => {
  assert.equal(
    shopifyDashboardCallbackError({
      errorFlag: "1",
      detail: "connection_failed",
      connection: {
        status: "error",
        last_webhook_at: null,
        last_reconciled_at: null,
      },
      catalogTotal: 0,
    }),
    "Shopify approved the app, but Reswell could not finish linking the store. Try again.",
  )
})
