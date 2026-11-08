import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const proxySource = readFileSync(
  new URL("../supabase/proxy.ts", import.meta.url),
  "utf8",
)
const rootProxySource = readFileSync(
  new URL("../../proxy.ts", import.meta.url),
  "utf8",
)
const headerSource = readFileSync(
  new URL("../../components/header.tsx", import.meta.url),
  "utf8",
)
const seoRedirectSource = readFileSync(
  new URL("../seo/edge-redirects.ts", import.meta.url),
  "utf8",
)

describe("request-path regressions", () => {
  it("limits middleware getUser attempts to two", () => {
    assert.match(proxySource, /const getUserAttempts = 2\b/)
  })

  it("does not HTML-redirect Server Action posts", () => {
    assert.match(proxySource, /passServerActionOrRedirect/)
    assert.match(proxySource, /isServerActionRequest/)
    assert.match(rootProxySource, /isServerActionRequest/)
    assert.match(rootProxySource, /HTML 302s break Server Actions/)
    assert.match(seoRedirectSource, /isServerActionRequest\(request\)\) return null/)
  })

  it("keeps messaging Realtime without wallet table bindings", () => {
    const realtimeStart = headerSource.indexOf(
      "/** Messaging profile and conversations",
    )
    const routeRefreshStart = headerSource.indexOf(
      "/** Lightweight wallet + unread resync on route changes",
    )
    assert.ok(realtimeStart >= 0)
    assert.ok(routeRefreshStart > realtimeStart)

    const realtimeSource = headerSource.slice(realtimeStart, routeRefreshStart)
    assert.doesNotMatch(realtimeSource, /table: "wallets"/)
    assert.doesNotMatch(realtimeSource, /table: "wallet_transactions"/)
    assert.match(realtimeSource, /table: "profiles"/)
    assert.match(realtimeSource, /table: "conversations"/)

    const routeRefreshSource = headerSource.slice(routeRefreshStart)
    assert.match(routeRefreshSource, /\.from\("wallets"\)/)
  })
})
