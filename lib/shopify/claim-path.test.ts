import assert from "node:assert/strict"
import test from "node:test"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import {
  isShopifyClaimPath,
  SHOPIFY_CONNECT_PATH,
  shopifyConnectHref,
} from "@/lib/shopify/claim-path"

test("identifies Shopify claim and connect paths", () => {
  assert.equal(isShopifyClaimPath("/shopify/claim"), true)
  assert.equal(isShopifyClaimPath("/shopify/claim/"), true)
  assert.equal(isShopifyClaimPath("/shopify/connect"), true)
  assert.equal(isShopifyClaimPath("/shopify/connect/"), true)
  assert.equal(isShopifyClaimPath("/dashboard/shopify"), false)
})

test("login from Shopify connect returns to the connect page", () => {
  assert.equal(
    authLandingHref("/auth/login", SHOPIFY_CONNECT_PATH),
    "/auth/login?redirect=%2Fshopify%2Fconnect",
  )
})

test("claim redirects to connect and keeps the query", () => {
  assert.equal(shopifyConnectHref({}), "/shopify/connect")
  assert.equal(
    shopifyConnectHref({ error: "connection_failed" }),
    "/shopify/connect?error=connection_failed",
  )
})
