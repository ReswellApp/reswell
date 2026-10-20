import assert from "node:assert/strict"
import test from "node:test"

const ENV_KEYS = ["NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL"] as const
const snapshot = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<(typeof ENV_KEYS)[number], string | undefined>

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = snapshot[key]
    if (value == null) delete process.env[key]
    else process.env[key] = value
  }
}

test.after(restoreEnv)

test("protected resource metadata points at Reswell MCP and site issuer", async () => {
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.reswell.app"
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.VERCEL_URL

  const { buildMcpProtectedResourceMetadata, buildMcpAuthorizationServerMetadata } =
    await import("@/lib/services/mcpMetadata")

  const prm = buildMcpProtectedResourceMetadata()
  assert.equal(prm.resource, "https://www.reswell.app/api/mcp")
  assert.deepEqual(prm.authorization_servers, ["https://www.reswell.app"])
  assert.ok(prm.scopes_supported.includes("search"))
  assert.ok(prm.scopes_supported.includes("checkout"))

  const asMeta = buildMcpAuthorizationServerMetadata()
  assert.equal(asMeta.issuer, "https://www.reswell.app")
  assert.equal(asMeta.authorization_endpoint, "https://www.reswell.app/oauth/authorize")
  assert.equal(asMeta.token_endpoint, "https://www.reswell.app/api/oauth/token")
  assert.equal(asMeta.registration_endpoint, "https://www.reswell.app/api/oauth/register")
  assert.deepEqual(asMeta.code_challenge_methods_supported, ["S256"])
})
