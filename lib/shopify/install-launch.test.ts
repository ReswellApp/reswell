import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import test from "node:test"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { verifyShopifyOAuthHmac } from "@/lib/shopify/crypto"
import {
  assessShopifyInstallLaunch,
  decideShopifyConnectInstall,
} from "@/lib/shopify/install-launch"

const SECRET = "test-shopify-secret"

function signedInstallQuery(overrides?: Record<string, string>): URLSearchParams {
  const params = new URLSearchParams({
    host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvbXF6aGNnLWM4",
    shop: "mqzhcg-c8.myshopify.com",
    timestamp: "1791646416",
    ...overrides,
  })
  const message = [...params.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join("&")
  params.set("hmac", createHmac("sha256", SECRET).update(message).digest("hex"))
  return params
}

test.before(() => {
  process.env.SHOPIFY_API_SECRET = SECRET
})

test("verified install launch keeps the exact connect URL for sign-in", () => {
  const params = signedInstallQuery()
  const launch = assessShopifyInstallLaunch(params)
  assert.equal(launch.kind, "verified")
  if (launch.kind !== "verified") return

  assert.equal(launch.shopDomain, "mqzhcg-c8.myshopify.com")
  assert.equal(launch.returnPath.startsWith("/shopify/connect?"), true)
  const returned = new URLSearchParams(launch.returnPath.slice("/shopify/connect?".length))
  assert.equal(returned.get("shop"), params.get("shop"))
  assert.equal(returned.get("hmac"), params.get("hmac"))
  assert.equal(returned.get("timestamp"), params.get("timestamp"))
  assert.equal(returned.get("host"), params.get("host"))
  assert.equal(verifyShopifyOAuthHmac(returned), true)
  assert.equal(safeRedirectPath(launch.returnPath), launch.returnPath)
  assert.equal(
    authLandingHref("/auth/login", launch.returnPath),
    `/auth/login?redirect=${encodeURIComponent(launch.returnPath)}`,
  )

  const decision = decideShopifyConnectInstall({
    launch,
    signedIn: false,
    shopifyConnectEnabled: false,
    publicInstallAvailable: true,
  })
  assert.equal(decision.action, "sign_in")
  if (decision.action === "sign_in") {
    assert.equal(decision.returnPath, launch.returnPath)
  }
})

test("signed-in merchant without access does not start OAuth", () => {
  const decision = decideShopifyConnectInstall({
    launch: assessShopifyInstallLaunch(signedInstallQuery()),
    signedIn: true,
    shopifyConnectEnabled: false,
    publicInstallAvailable: true,
  })
  assert.equal(decision.action, "request_access")
})

test("signed-in eligible merchant continues the public install", () => {
  const decision = decideShopifyConnectInstall({
    launch: assessShopifyInstallLaunch(signedInstallQuery()),
    signedIn: true,
    shopifyConnectEnabled: true,
    publicInstallAvailable: true,
  })
  assert.equal(decision.action, "start_public_install")
  if (decision.action === "start_public_install") {
    assert.equal(decision.shopDomain, "mqzhcg-c8.myshopify.com")
  }
})

test("invalid or missing HMAC does not start OAuth", () => {
  const missing = new URLSearchParams({
    host: "YWRtaW4uc2hvcGlmeS5jb20vc3RvcmUvbXF6aGNnLWM4",
    shop: "mqzhcg-c8.myshopify.com",
    timestamp: "1791646416",
  })
  const tampered = signedInstallQuery()
  tampered.set("shop", "evil.myshopify.com")

  for (const params of [missing, tampered]) {
    const launch = assessShopifyInstallLaunch(params)
    assert.equal(launch.kind, "rejected")
    const decision = decideShopifyConnectInstall({
      launch,
      signedIn: true,
      shopifyConnectEnabled: true,
      publicInstallAvailable: true,
    })
    assert.equal(decision.action, "reject_install")
    assert.notEqual(decision.action, "start_public_install")
  }
})

test("oauth code and plain claim visits do not start a new install", () => {
  const withCode = signedInstallQuery({ code: "one-time-code" })
  assert.equal(assessShopifyInstallLaunch(withCode).kind, "absent")
  assert.equal(assessShopifyInstallLaunch(new URLSearchParams()).kind, "absent")
  assert.equal(
    assessShopifyInstallLaunch(new URLSearchParams("error=connection_failed")).kind,
    "absent",
  )
})

test("unconfigured Shopify secret rejects the launch instead of trusting shop", () => {
  const params = signedInstallQuery()
  delete process.env.SHOPIFY_API_SECRET
  try {
    assert.equal(assessShopifyInstallLaunch(params).kind, "rejected")
  } finally {
    process.env.SHOPIFY_API_SECRET = SECRET
  }
})
