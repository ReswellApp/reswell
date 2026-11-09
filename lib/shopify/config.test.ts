import assert from "node:assert/strict"
import test from "node:test"
import {
  isShopifyAccountOAuthConfigured,
  isShopifyConfigured,
  isShopifyPublicOAuthConfigured,
  isShopifyPublicOAuthEnabled,
  missingShopifyReadScopes,
  normalizeShopifyDomain,
  parseShopifyAppInstallUrl,
  shopifyAppInstallUrl,
} from "@/lib/shopify/config"

const keys = [
  "SHOPIFY_INTEGRATION_ENABLED",
  "SHOPIFY_PUBLIC_OAUTH_ENABLED",
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

test("parses Shopify-owned HTTPS install URLs without crashing on invalid hosts", () => {
  delete process.env.SHOPIFY_APP_INSTALL_URL
  assert.equal(parseShopifyAppInstallUrl(), null)
  assert.throws(
    () => shopifyAppInstallUrl(),
    /SHOPIFY_APP_INSTALL_URL is not configured/,
  )

  process.env.SHOPIFY_APP_INSTALL_URL = "  https://apps.shopify.com/reswell  "
  assert.equal(
    parseShopifyAppInstallUrl(),
    "https://apps.shopify.com/reswell",
  )
  assert.equal(shopifyAppInstallUrl(), "https://apps.shopify.com/reswell")

  process.env.SHOPIFY_APP_INSTALL_URL = "https://admin.shopify.com/store/apps"
  assert.equal(
    parseShopifyAppInstallUrl(),
    "https://admin.shopify.com/store/apps",
  )
  process.env.SHOPIFY_APP_INSTALL_URL = "https://shopify.com/admin"
  assert.equal(parseShopifyAppInstallUrl(), "https://shopify.com/admin")
  process.env.SHOPIFY_APP_INSTALL_URL = "https://www.shopify.com/apps"
  assert.equal(parseShopifyAppInstallUrl(), "https://www.shopify.com/apps")

  process.env.SHOPIFY_APP_INSTALL_URL = "https://evil.example/install"
  assert.equal(parseShopifyAppInstallUrl(), null)
  assert.throws(
    () => shopifyAppInstallUrl(),
    /SHOPIFY_APP_INSTALL_URL must be a Shopify-owned HTTPS URL/,
  )

  process.env.SHOPIFY_APP_INSTALL_URL = "not a url"
  assert.equal(parseShopifyAppInstallUrl(), null)

  process.env.SHOPIFY_API_KEY = "key"
  process.env.SHOPIFY_API_SECRET = "secret"
  process.env.SHOPIFY_APP_INSTALL_URL = "https://partner.example/install"
  assert.equal(isShopifyPublicOAuthConfigured(), false)
})

test("public OAuth is configured from the Reswell app credentials", () => {
  process.env.SHOPIFY_INTEGRATION_ENABLED = "true"
  process.env.SHOPIFY_PUBLIC_OAUTH_ENABLED = "true"
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64")
  process.env.SHOPIFY_API_KEY = "key"
  process.env.SHOPIFY_API_SECRET = "secret"
  process.env.SHOPIFY_APP_INSTALL_URL = "https://apps.shopify.com/reswell"

  assert.equal(isShopifyPublicOAuthEnabled(), true)
  assert.equal(isShopifyPublicOAuthConfigured(), true)
  assert.equal(isShopifyConfigured(), true)

  delete process.env.SHOPIFY_API_KEY
  assert.equal(isShopifyPublicOAuthConfigured(), false)
  assert.equal(isShopifyAccountOAuthConfigured(), false)
  assert.equal(isShopifyConfigured(), false)
})

test("Reswell-started OAuth does not need SHOPIFY_APP_INSTALL_URL", () => {
  process.env.SHOPIFY_INTEGRATION_ENABLED = "true"
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 3).toString("base64")
  process.env.SHOPIFY_API_KEY = "key"
  process.env.SHOPIFY_API_SECRET = "secret"
  delete process.env.SHOPIFY_APP_INSTALL_URL

  assert.equal(isShopifyAccountOAuthConfigured(), true)
  assert.equal(isShopifyPublicOAuthConfigured(), false)
  assert.equal(isShopifyConfigured(), true)

  delete process.env.SHOPIFY_API_SECRET
  assert.equal(isShopifyAccountOAuthConfigured(), false)
  assert.equal(isShopifyConfigured(), false)
})

test("reports Shopify read scopes that were not granted", () => {
  assert.deepEqual(
    missingShopifyReadScopes(["read_products", "read_inventory", "read_locations"]),
    [],
  )
  assert.deepEqual(missingShopifyReadScopes(["read_products", "write_inventory"]), [
    "read_inventory",
    "read_locations",
  ])
})
