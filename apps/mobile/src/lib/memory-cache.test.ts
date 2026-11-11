import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MobileMarketplaceFeed } from "@reswell/api-contract"
import { createMemoryCache } from "./memory-cache.ts"
import {
  categoryListingsCacheKey,
  clearMarketplaceScreenCache,
  loadFeed,
  loadHome,
  loadSearchSuggest,
  MARKETPLACE_PUBLIC_GET_FRESH_MS,
  peekHome,
} from "./marketplace-screen-cache.ts"

const emptyFeed = {
  tab: "new",
  title: "New",
  subtitle: "",
  listings: [],
  page: 1,
  page_size: 20,
  has_more: false,
  next_cursor: null,
  stats: null,
} as MobileMarketplaceFeed

describe("memory cache", () => {
  it("peeks stale values while skipping a fresh loader", async () => {
    const cache = createMemoryCache<string>({ freshMs: 5_000 })
    let loads = 0
    await cache.load("home", () => {
      loads += 1
      return Promise.resolve("first")
    })
    await cache.load("home", () => {
      loads += 1
      return Promise.resolve("second")
    })
    assert.equal(cache.peek("home"), "first")
    assert.equal(loads, 1)
  })

  it("dedupes in-flight loads", async () => {
    const cache = createMemoryCache<string>()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve("one")
    }
    await Promise.all([cache.load("k", loader), cache.load("k", loader)])
    assert.equal(loads, 1)
  })

  it("force bypasses a fresh value", async () => {
    const cache = createMemoryCache<string>({ freshMs: 5_000 })
    await cache.load("k", () => Promise.resolve("old"))
    await cache.load("k", () => Promise.resolve("new"), { force: true })
    assert.equal(cache.peek("k"), "new")
  })

  it("uses per-load freshMs so a zero TTL always refetches", async () => {
    const cache = createMemoryCache<string>({ freshMs: 5_000 })
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve(`v${loads}`)
    }
    await cache.load("k", loader, { freshMs: 0 })
    await cache.load("k", loader, { freshMs: 0 })
    assert.equal(loads, 2)
  })
})

describe("marketplace public GET cache", () => {
  it("matches public s-maxage so Redis hits are not wasted on refetch", () => {
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.home, 60_000)
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.browseRail, 300_000)
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.category, 300_000)
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.categoryListings, 30_000)
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.feed, 60_000)
    assert.equal(MARKETPLACE_PUBLIC_GET_FRESH_MS.search, 30_000)
  })

  it("skips a second home load while the public GET TTL is fresh", async () => {
    clearMarketplaceScreenCache()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve({ sections: [] })
    }
    await loadHome(loader)
    await loadHome(loader)
    assert.equal(loads, 1)
    assert.equal(peekHome()?.sections.length, 0)
  })

  it("skips a second anonymous feed load while the public GET TTL is fresh", async () => {
    clearMarketplaceScreenCache()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve(emptyFeed)
    }
    await loadFeed("new", null, loader)
    await loadFeed("new", null, loader)
    assert.equal(loads, 1)
  })

  it("refetches a signed-in feed so private responses are not treated as public", async () => {
    clearMarketplaceScreenCache()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve(emptyFeed)
    }
    await loadFeed("new", "token-aaaaaaaaaaaa", loader)
    await loadFeed("new", "token-aaaaaaaaaaaa", loader)
    assert.equal(loads, 2)
  })

  it("dedupes in-flight search suggest loads", async () => {
    clearMarketplaceScreenCache()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve([])
    }
    await Promise.all([loadSearchSuggest("twin", loader), loadSearchSuggest("Twin", loader)])
    assert.equal(loads, 1)
  })

  it("ignores offset when keying category listings", () => {
    const first = categoryListingsCacheKey("surfboards", { offset: 0, sort: "newest" })
    const paged = categoryListingsCacheKey("surfboards", { offset: 20, sort: "newest" })
    assert.equal(first, paged)
    assert.notEqual(first, categoryListingsCacheKey("fins", { sort: "newest" }))
  })
})
