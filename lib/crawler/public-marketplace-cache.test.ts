import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  BROWSER_HTML_CACHE_CONTROL,
  PUBLIC_MARKETPLACE_EDGE_CACHE_CONTROL,
  isCacheablePublicMarketplaceRequest,
  publicMarketplaceCdnCacheControl,
  shouldAttachDeviceCookieOnDocument,
} from "./public-marketplace-cache-policy.ts"
import { shouldAttachDeviceCookieOnDocument as attachDeviceCookieOnPath } from "./public-marketplace-paths.ts"

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

  it("tells browsers to revalidate marketplace HTML so deploys cannot serve stale chunk hashes", () => {
    assert.equal(BROWSER_HTML_CACHE_CONTROL, "public, max-age=0, must-revalidate")
    const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8")
    assert.match(proxy, /CDN-Cache-Control/)
    assert.match(proxy, /BROWSER_HTML_CACHE_CONTROL/)
    assert.match(proxy, /Cache-Control/)
  })

  it("does not CDN-cache server action posts on public marketplace URLs", () => {
    assert.equal(isCacheablePublicMarketplaceRequest("GET", false), true)
    assert.equal(isCacheablePublicMarketplaceRequest("HEAD", false), true)
    assert.equal(isCacheablePublicMarketplaceRequest("POST", false), false)
    assert.equal(isCacheablePublicMarketplaceRequest("POST", true), false)
    assert.equal(isCacheablePublicMarketplaceRequest("GET", true), false)
    const proxy = readFileSync(new URL("../../proxy.ts", import.meta.url), "utf8")
    assert.match(proxy, /isCacheablePublicMarketplaceRequest/)
    assert.match(proxy, /isServerActionRequest/)
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
    const modelPage = readFileSync(
      new URL("../../app/[brand]/[model]/page.tsx", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(modelPage, /createClient\(/)
    assert.doesNotMatch(modelPage, /auth\.getUser\(/)
    assert.doesNotMatch(chrome, /from ["']next\/headers["']/)
    assert.doesNotMatch(listing, /from ["']next\/headers["']/)
    assert.match(listing, /anonymousPublicView:\s*true/)
    assert.doesNotMatch(shop, /auth\.getUser\(/)
    assert.match(proxy, /shouldAttachDeviceCookieOnDocument/)
    assert.match(proxy, /applyPublicMarketplaceCacheHints/)
    assert.match(proxy, /media\//)
  })

  it("does not attach the device cookie on public media paths", () => {
    assert.equal(attachDeviceCookieOnPath("/media/listings/abc/file.jpg"), false)
    assert.equal(attachDeviceCookieOnPath("/media/listing-videos/abc/clip.mp4"), false)
    assert.equal(attachDeviceCookieOnPath("/dashboard/listings"), true)
  })

  it("resolves the /boards pin CMS after mount, not in the cached document", () => {
    const page = readFileSync(
      new URL("../../components/boards-browse-page.tsx", import.meta.url),
      "utf8",
    )
    const curator = readFileSync(
      new URL("../../components/boards-browse-admin-curator.tsx", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(page, /BoardsBrowseAdminCuratorGate/)
    assert.doesNotMatch(page, /select\("is_admin"\)/)
    assert.match(curator, /browserProfileIsAdmin\(/)
    assert.match(curator, /fromBrowser !== null/)
    assert.doesNotMatch(curator, /from ["']next\/headers["']/)
  })
})
