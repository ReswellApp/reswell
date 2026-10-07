import assert from "node:assert/strict"
import test from "node:test"
import {
  isShopifyConfigured,
  isShopifyManualCanaryEnabled,
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  normalizeShopifyDomain,
  shopifyAppInstallUrl,
} from "@/lib/shopify/config"
import { shopifyManualConnectBodySchema } from "@/lib/validations/shopify"

const keys = [
  "SHOPIFY_INTEGRATION_ENABLED",
  "SHOPIFY_PUBLIC_OAUTH_ENABLED",
  "SHOPIFY_MANUAL_CANARY_ENABLED",
  "SHOPIFY_TOKEN_ENCRYPTION_KEY",
  "SHOPIFY_API_KEY",
  "SHOPIFY_API_SECRET",
  "SHOPIFY_APP_INSTALL_URL",
] as const

const snapshot = Object.fromEntries(
  keys.map((key) => [key, process.env[key]]),
) as Record<(typeof keys)[number], string | undefined>

function restoreEnv() {
  for (const key of keys) {
    const value = snapshot[key]
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
}

test.after(restoreEnv)

test("normalizes myshopify domains and rejects custom hosts", () => {
  assert.equal(
    normalizeShopifyDomain("Reswell-Pilot.myshopify.com/admin"),
    "reswell-pilot.myshopify.com",
  )
  assert.equal(normalizeShopifyDomain("reswell-pilot"), "reswell-pilot.myshopify.com")
  assert.equal(normalizeShopifyDomain("https://store.example.com"), null)
})

test("requires Shopify-owned HTTPS install URLs", () => {
  process.env.SHOPIFY_APP_INSTALL_URL = "https://apps.shopify.com/reswell"
  assert.equal(
    shopifyAppInstallUrl(),
    "https://apps.shopify.com/reswell",
  )
  process.env.SHOPIFY_APP_INSTALL_URL = "https://evil.example/install"
  assert.throws(() => shopifyAppInstallUrl())
})

test("public OAuth and manual canary flags stay independent", () => {
  process.env.SHOPIFY_INTEGRATION_ENABLED = "true"
  process.env.SHOPIFY_PUBLIC_OAUTH_ENABLED = "true"
  process.env.SHOPIFY_MANUAL_CANARY_ENABLED = "false"
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64")
  process.env.SHOPIFY_API_KEY = "key"
  process.env.SHOPIFY_API_SECRET = "secret"
  process.env.SHOPIFY_APP_INSTALL_URL = "https://apps.shopify.com/reswell"

  assert.equal(isShopifyPublicOAuthEnabled(), true)
  assert.equal(isShopifyPublicOAuthConfigured(), true)
  assert.equal(isShopifyManualCanaryEnabled(), false)
  assert.equal(isShopifyConfigured(), true)

  delete process.env.SHOPIFY_API_KEY
  process.env.SHOPIFY_MANUAL_CANARY_ENABLED = "true"
  assert.equal(isShopifyPublicOAuthConfigured(), false)
  assert.equal(isShopifyManualCanaryEnabled(), true)
  assert.equal(isShopifyConfigured(), true)
})

test("merchant custom connect requires client credentials, not a static token", () => {
  const parsed = shopifyManualConnectBodySchema.safeParse({
    shop: "reswell-pilot.myshopify.com",
    clientId: "shopify-app-client-id",
    clientSecret: "shopify-app-client-secret",
    accessToken: "shpat_should_be_ignored",
  })
  assert.equal(parsed.success, true)
  if (parsed.success) {
    assert.equal("accessToken" in parsed.data, false)
  }
  assert.equal(
    shopifyManualConnectBodySchema.safeParse({
      shop: "reswell-pilot.myshopify.com",
      accessToken: "shpat_only",
    }).success,
    false,
  )
})
