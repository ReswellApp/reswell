import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import {
  decryptShopifySecret,
  encryptShopifySecret,
  hashShopifyOAuthState,
  verifyShopifyOAuthHmac,
  verifyShopifyWebhookHmac,
} from "@/lib/shopify/crypto"

const priorSecret = process.env.SHOPIFY_API_SECRET
const priorKey = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY
const priorVersion = process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION

test.before(() => {
  process.env.SHOPIFY_API_SECRET = "test-shopify-secret"
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64")
  process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = "1"
})

test.after(() => {
  if (priorSecret == null) delete process.env.SHOPIFY_API_SECRET
  else process.env.SHOPIFY_API_SECRET = priorSecret
  if (priorKey == null) delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY
  else process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = priorKey
  if (priorVersion == null) delete process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION
  else process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY_VERSION = priorVersion
})

test("encrypts and authenticates Shopify credentials", () => {
  const encrypted = encryptShopifySecret("shpat_test_token")
  assert.notEqual(encrypted.ciphertext, "shpat_test_token")
  assert.equal(decryptShopifySecret(encrypted), "shpat_test_token")

  assert.throws(() =>
    decryptShopifySecret({ ...encrypted, tag: Buffer.alloc(16).toString("base64") }),
  )
})

test("verifies OAuth callback HMAC over sorted parameters", () => {
  const params = new URLSearchParams({
    shop: "reswell-test.myshopify.com",
    code: "one-time-code",
    timestamp: "1791244800",
    state: "state-token",
  })
  const message = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  params.set(
    "hmac",
    createHmac("sha256", "test-shopify-secret")
      .update(message)
      .digest("hex"),
  )
  assert.equal(verifyShopifyOAuthHmac(params), true)
  params.set("code", "tampered")
  assert.equal(verifyShopifyOAuthHmac(params), false)
})

test("verifies webhook HMAC and hashes OAuth state without storing it", () => {
  const body = JSON.stringify({ id: 123 })
  const hmac = createHmac("sha256", "test-shopify-secret")
    .update(body)
    .digest("base64")
  assert.equal(verifyShopifyWebhookHmac(body, hmac), true)
  assert.equal(verifyShopifyWebhookHmac(`${body} `, hmac), false)
  assert.equal(hashShopifyOAuthState("state").length, 64)
  assert.notEqual(hashShopifyOAuthState("state"), "state")
})
