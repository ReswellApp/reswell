import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { supabaseAuthForwardPathname } from "@/lib/auth/supabase-auth-forward-path"

function forward(path: string): string | null {
  const url = new URL(path, "https://www.reswell.app")
  return supabaseAuthForwardPathname(url.pathname, url.searchParams)
}

describe("supabaseAuthForwardPathname", () => {
  it("leaves Shopify and PayPal OAuth callbacks on their API routes", () => {
    assert.equal(
      forward(
        "/api/integrations/shopify/callback?code=shopify-code&hmac=abc&shop=mqzhcg-c8.myshopify.com&state=s",
      ),
      null,
    )
    assert.equal(forward("/api/auth/paypal/callback?code=paypal-code&state=s"), null)
  })

  it("forwards a Supabase code that lands on a page", () => {
    assert.equal(forward("/?code=supabase-code"), "/auth/callback")
    assert.equal(forward("/?code=supabase-code&type=recovery"), "/auth/recovery")
  })

  it("forwards token_hash links by type", () => {
    assert.equal(forward("/?token_hash=t&type=recovery"), "/auth/recovery")
    assert.equal(forward("/?token_hash=t&type=signup"), "/auth/confirm")
    assert.equal(forward("/?token_hash=t&type=magiclink"), "/auth/callback")
  })

  it("does not forward requests already on their auth handler", () => {
    assert.equal(forward("/auth/callback?code=supabase-code"), null)
    assert.equal(forward("/auth/recovery?code=supabase-code"), null)
    assert.equal(forward("/auth/confirm?token_hash=t&type=signup"), null)
    assert.equal(forward("/boards"), null)
  })
})
