import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { publicMarketplaceCdnCacheControl } from "./public-marketplace-paths.ts"
import { LISTING_HTML_CDN_CACHE_CONTROL } from "./public-marketplace-cache-policy.ts"
import { hasSupabaseAuthCookies } from "../auth/has-supabase-auth-cookies.ts"
import {
  listingParamFromPublicPath,
  listingRendersAnonymousPublicShell,
  shouldAttachListingCdnCacheHeader,
  shouldCdnCacheListingHtml,
} from "./listing-html-cdn-policy.ts"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("anonymous public listing CDN header", () => {
  it("only caches guest-visible listing rows from the hourly cache", () => {
    assert.equal(
      shouldCdnCacheListingHtml({
        queryFailed: false,
        listing: { hidden_from_site: false },
      }),
      true,
    )
    assert.equal(
      shouldCdnCacheListingHtml({
        queryFailed: false,
        listing: { hidden_from_site: true },
      }),
      false,
    )
    assert.equal(
      shouldCdnCacheListingHtml({ queryFailed: false, listing: null }),
      false,
    )
    assert.equal(
      shouldCdnCacheListingHtml({
        queryFailed: true,
        listing: { hidden_from_site: false },
      }),
      false,
    )
    assert.equal(listingRendersAnonymousPublicShell(null), false)
    assert.equal(
      listingRendersAnonymousPublicShell({ hidden_from_site: false }),
      true,
    )
  })

  it("does not attach the public CDN header for a signed-in or owner render even when the listing is public", () => {
    const publicRow = { hidden_from_site: false }
    assert.equal(
      shouldAttachListingCdnCacheHeader({
        hasSetCookie: false,
        hasRequestSession: true,
        cachedPublicListing: publicRow,
      }),
      false,
    )
    assert.equal(
      publicMarketplaceCdnCacheControl("/l/lost-pisces", false, {
        isAnonymousPublicListingHtml: true,
        hasRequestSession: true,
      }),
      null,
    )
    assert.equal(
      hasSupabaseAuthCookies([{ name: "sb-reswell-auth-token" }]),
      true,
    )
    assert.equal(
      shouldAttachListingCdnCacheHeader({
        hasSetCookie: false,
        hasRequestSession: false,
        cachedPublicListing: publicRow,
      }),
      true,
    )
    assert.equal(
      publicMarketplaceCdnCacheControl("/l/lost-pisces", false, {
        isAnonymousPublicListingHtml: true,
        hasRequestSession: false,
      }),
      LISTING_HTML_CDN_CACHE_CONTROL,
    )
  })

  it("does not cache DynamicGate when the hourly cache missed a live public row", () => {
    assert.equal(
      shouldAttachListingCdnCacheHeader({
        hasSetCookie: false,
        hasRequestSession: false,
        cachedPublicListing: null,
      }),
      false,
    )
  })

  it("does not treat a listing path as public until the anonymous public shell will render", () => {
    assert.equal(listingParamFromPublicPath("/l/lost-pisces"), "lost-pisces")
    assert.equal(publicMarketplaceCdnCacheControl("/l/lost-pisces", false), null)
    assert.equal(
      publicMarketplaceCdnCacheControl("/l/lost-pisces", false, {
        isAnonymousPublicListingHtml: true,
      }),
      LISTING_HTML_CDN_CACHE_CONTROL,
    )
    assert.doesNotMatch(LISTING_HTML_CDN_CACHE_CONTROL, /stale-while-revalidate/)
  })

  it("uses the hourly public cache and skips session requests so DynamicGate is never stored as public", () => {
    const lookup = readRepo("lib/crawler/listing-html-cdn.ts")
    assert.match(lookup, /getCachedPublicListingDetailRow/)
    assert.doesNotMatch(lookup, /createAnonSupabaseClient/)
    assert.doesNotMatch(lookup, /getCachedRequestSession/)

    const proxy = readRepo("proxy.ts")
    assert.match(proxy, /listingIsAnonymousPublicHtml/)
    assert.match(proxy, /hasSupabaseAuthCookies/)
    assert.match(proxy, /hasRequestSession/)
    assert.match(proxy, /isAnonymousPublicListingHtml/)

    const page = readRepo("app/l/[listing]/page.tsx")
    assert.match(page, /listingRendersAnonymousPublicShell/)
    assert.match(page, /ListingDetailDynamicGate/)
    assert.match(page, /ListingDetailPublicOrAuthenticated/)
    assert.doesNotMatch(page, /LISTING_HTML_CDN_CACHE_CONTROL/)
  })
})
