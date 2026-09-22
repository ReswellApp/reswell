import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
  publicMarketplaceCdnCacheControl,
  shouldAttachDeviceCookieOnDocument,
} from "./public-marketplace-cache-policy.ts"

describe("public marketplace document cache", () => {
  it("does not set the device cookie on marketplace HTML", () => {
    assert.equal(shouldAttachDeviceCookieOnDocument(true), false)
    assert.equal(shouldAttachDeviceCookieOnDocument(false), true)
  })

  it("sets the edge cache header only when the response has no Set-Cookie", () => {
    assert.equal(publicMarketplaceCdnCacheControl(true, false), PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL)
    assert.equal(publicMarketplaceCdnCacheControl(true, true), null)
    assert.equal(publicMarketplaceCdnCacheControl(false, false), null)
  })

  it("keeps cookies() off the anonymous shell", () => {
    const chrome = readFileSync(new URL("../../components/site-chrome.tsx", import.meta.url), "utf8")
    const listing = readFileSync(
      new URL(
        "../../components/features/listings/listing-detail-public-or-authenticated.tsx",
        import.meta.url,
      ),
      "utf8",
    )
    const shop = readFileSync(
      new URL("../../components/shop-listing-detail-page.tsx", import.meta.url),
      "utf8",
    )
    const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8")
    assert.doesNotMatch(chrome, /from ["']next\/headers["']/)
    assert.doesNotMatch(listing, /from ["']next\/headers["']/)
    assert.match(listing, /anonymousPublicView:\s*true/)
    assert.doesNotMatch(shop, /auth\.getUser\(/)
    assert.match(proxy, /shouldAttachDeviceCookieOnDocument/)
    assert.match(proxy, /applyPublicMarketplaceCacheHints/)
  })
})
