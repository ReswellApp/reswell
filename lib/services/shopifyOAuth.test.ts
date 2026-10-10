import assert from "node:assert/strict"
import { register } from "node:module"
import test from "node:test"
import type { SupabaseClient } from "@supabase/supabase-js"

// createShopifyInstallUrl lives beside the Supabase server client import.
// Node's test runner cannot resolve next/headers, and this test never calls it.
register(
  "data:text/javascript," +
    encodeURIComponent(`
export async function resolve(specifier, context, nextResolve) {
  if (specifier === "next/headers") {
    const stub = "export function cookies() { return { getAll() { return [] }, setAll() {} } }"
    return {
      url: "data:text/javascript," + encodeURIComponent(stub),
      shortCircuit: true,
    }
  }
  return nextResolve(specifier, context)
}
`),
)

const { createShopifyInstallUrl } = await import("@/lib/services/shopifyOAuth")

const ENV_KEYS = ["SHOPIFY_API_KEY", "NEXT_PUBLIC_SITE_URL", "NEXT_PUBLIC_APP_URL", "VERCEL_URL"] as const

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

function oauthStateSupabase(): SupabaseClient {
  const table = {
    delete() {
      return table
    },
    lt() {
      return Promise.resolve({ error: null })
    },
    insert() {
      return Promise.resolve({ error: null })
    },
  }
  return {
    from(name: string) {
      assert.equal(name, "shopify_oauth_states")
      return table
    },
  } as unknown as SupabaseClient
}

test.after(restoreEnv)

test("authorize URL omits scope when the app version already declares scopes", async () => {
  process.env.SHOPIFY_API_KEY = "shopify-client-id"
  process.env.NEXT_PUBLIC_SITE_URL = "https://www.reswell.app"
  delete process.env.NEXT_PUBLIC_APP_URL
  delete process.env.VERCEL_URL

  const href = await createShopifyInstallUrl({
    serviceSupabase: oauthStateSupabase(),
    userId: "user-1",
    shopDomain: "reswell-pilot.myshopify.com",
  })

  const url = new URL(href)
  assert.equal(
    url.origin + url.pathname,
    "https://reswell-pilot.myshopify.com/admin/oauth/authorize",
  )
  assert.equal(url.searchParams.has("scope"), false)
  assert.equal(url.searchParams.get("client_id"), "shopify-client-id")
  assert.equal(
    url.searchParams.get("redirect_uri"),
    "https://www.reswell.app/api/integrations/shopify/callback",
  )
  assert.equal(typeof url.searchParams.get("state"), "string")
  assert.ok((url.searchParams.get("state") ?? "").length > 0)
  assert.deepEqual(
    [...url.searchParams.keys()].sort(),
    ["client_id", "redirect_uri", "state"],
  )
})
