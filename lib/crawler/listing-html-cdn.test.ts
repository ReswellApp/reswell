import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { publicMarketplaceCdnCacheControl } from "./public-marketplace-paths.ts"
import { LISTING_HTML_CDN_CACHE_CONTROL } from "./public-marketplace-cache-policy.ts"
import {
  listingParamFromPublicPath,
  shouldCdnCacheListingHtml,
} from "./listing-html-cdn-policy.ts"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("anonymous public listing CDN header", () => {
  it("only caches guest-visible listing rows", () => {
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
  })

  it("does not treat a listing path as public until the anonymous lookup says so", () => {
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

  it("looks up listings with the anon client and never caches DynamicGate HTML as public", () => {
    const lookup = readRepo("lib/crawler/listing-html-cdn.ts")
    const page = readRepo("app/l/[listing]/page.tsx")
    const cache = readRepo("lib/cache/listing-public-detail.ts")
    assert.match(lookup, /getCachedPublicListingDetailRow/)
    assert.match(lookup, /shouldCdnCacheListingHtml/)
    assert.doesNotMatch(lookup, /findListingByParam/)
    assert.doesNotMatch(lookup, /createAnonSupabaseClient/)
    assert.doesNotMatch(lookup, /getCachedRequestSession/)
    assert.match(cache, /includeHiddenListings:\s*false/)
    assert.match(cache, /getDb\(\{\s*consistency:\s*"strong"\s*\}\)/)
    assert.match(cache, /export function getCachedPublicListingDetailRow/)
    assert.match(cache, /getCachedPublicListingForRoute = cache\(async \(param: string\) => \{/)
    assert.match(cache, /return getCachedPublicListingDetailRow\(param\)/)

    const proxy = readRepo("proxy.ts")
    assert.match(proxy, /listingIsAnonymousPublicHtml/)
    assert.match(proxy, /isAnonymousPublicListingHtml/)

    assert.match(page, /getCachedPublicListingForRoute/)
    assert.match(page, /shouldCdnCacheListingHtml/)
    assert.match(page, /ListingDetailDynamicGate/)
    assert.match(page, /ListingDetailPublicOrAuthenticated/)
    assert.doesNotMatch(page, /LISTING_HTML_CDN_CACHE_CONTROL/)
  })
})
