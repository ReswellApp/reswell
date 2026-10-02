import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

function readRepo(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8")
}

describe("marketplace search page cache", () => {
  it("serves /search from a shared revalidate window without a session read", () => {
    const page = readRepo("app/search/page.tsx")
    assert.match(page, /export const revalidate = 60/)
    assert.doesNotMatch(page, /force-dynamic/)
    assert.match(page, /skipAuthLookup/)
  })

  it("caches parser and listing resolution without the cookie client", () => {
    const view = readRepo("app/search/search-page-view.tsx")
    assert.match(view, /unstable_cache/)
    assert.match(view, /MARKETPLACE_SEARCH_PAGE_CACHE_TAG/)
    assert.match(view, /getDb\(\{ consistency: "eventual" \}\)/)
    assert.match(view, /normalizeMarketplaceSearchQueryForAnalytics/)
    assert.match(view, /skipAuthLookup \? Promise\.resolve\(null\) : loadSearchPageUser\(\)/)
    assert.match(view, /loadFavoritedListingIds/)
    assert.match(view, /\.in\("listing_id", chunk\)/)
  })

  it("hydrates hearts for the listings on screen", () => {
    const feed = readRepo("components/recent-feed-client.tsx")
    assert.match(feed, /hydrateOwnFavorites/)
    assert.match(feed, /\.in\("listing_id", chunk\)/)
    assert.doesNotMatch(
      feed,
      /\.from\("favorites"\)\s*\.select\("listing_id"\)\s*\.eq\("user_id", user\.id\)\s*(?![\s\S]*\.in\()/,
    )
  })

  it("busts the search cache when listings or synonyms change", () => {
    const nav = readRepo("lib/cache/revalidate-nav-search-suggest.ts")
    const synonyms = readRepo("lib/services/searchSynonyms.ts")
    assert.match(nav, /revalidateMarketplaceSearchPage\(\)/)
    assert.match(synonyms, /revalidateMarketplaceSearchPage\(\)/)
  })
})
