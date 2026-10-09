import assert from "node:assert/strict"
import test from "node:test"
import { isShopifyClaimPath, SHOPIFY_CLAIM_PATH } from "@/lib/shopify/claim-path"
import { authLandingHref } from "@/lib/auth/auth-landing-href"

test("identifies the Shopify claim path", () => {
  assert.equal(isShopifyClaimPath("/shopify/claim"), true)
  assert.equal(isShopifyClaimPath("/shopify/claim/"), true)
  assert.equal(isShopifyClaimPath("/dashboard/shopify"), false)
})

test("login from Shopify claim returns to the claim page", () => {
  assert.equal(
    authLandingHref("/auth/login", SHOPIFY_CLAIM_PATH),
    "/auth/login?redirect=%2Fshopify%2Fclaim",
  )
})
