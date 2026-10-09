import assert from "node:assert/strict"
import test from "node:test"
import {
  isShopifyConnectPath,
  SHOPIFY_CLAIM_PATH,
  SHOPIFY_CONNECT_PATH,
} from "@/lib/shopify/claim-path"
import { authLandingHref } from "@/lib/auth/auth-landing-href"

test("identifies Shopify connect and legacy claim paths", () => {
  assert.equal(isShopifyConnectPath("/shopify/connect"), true)
  assert.equal(isShopifyConnectPath("/shopify/connect/"), true)
  assert.equal(isShopifyConnectPath("/shopify/claim"), true)
  assert.equal(isShopifyConnectPath("/shopify/claim/"), true)
  assert.equal(isShopifyConnectPath("/dashboard/shopify"), false)
})

test("login from Shopify connect returns to the connect page", () => {
  assert.equal(
    authLandingHref("/auth/login", SHOPIFY_CONNECT_PATH),
    "/auth/login?redirect=%2Fshopify%2Fconnect",
  )
  assert.equal(SHOPIFY_CLAIM_PATH, "/shopify/claim")
})
