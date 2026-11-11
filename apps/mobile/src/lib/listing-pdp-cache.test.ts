import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { MobileListingDetail } from "@reswell/api-contract"
import {
  clearListingPdpCache,
  forgetCachedListing,
  listingMatchesParam,
  loadCachedListing,
  peekCachedListing,
  rememberCachedListing,
} from "./listing-pdp-cache.ts"

const listing = {
  id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
  slug: "album-twin",
  title: "Album Twin",
} as MobileListingDetail

describe("listing PDP memory cache", () => {
  it("peeks by slug or id after remember", () => {
    clearListingPdpCache()
    rememberCachedListing(listing, "token-aaaaaaaaaaaa")
    assert.equal(peekCachedListing("album-twin", "token-aaaaaaaaaaaa")?.id, listing.id)
    assert.equal(peekCachedListing(listing.id, "token-aaaaaaaaaaaa")?.slug, "album-twin")
    assert.equal(peekCachedListing("album-twin", null), null)
  })

  it("reuses an in-flight load so listing screens share one request", async () => {
    clearListingPdpCache()
    let loads = 0
    const loader = () => {
      loads += 1
      return Promise.resolve(listing)
    }
    const first = loadCachedListing("album-twin", "token-aaaaaaaaaaaa", loader)
    const second = loadCachedListing("album-twin", "token-aaaaaaaaaaaa", loader)
    await Promise.all([first, second])
    assert.equal(loads, 1)
    assert.equal(peekCachedListing("album-twin", "token-aaaaaaaaaaaa")?.id, listing.id)
  })

  it("skips the loader while the value is still fresh", async () => {
    clearListingPdpCache()
    let loads = 0
    await loadCachedListing("album-twin", "token-aaaaaaaaaaaa", () => {
      loads += 1
      return Promise.resolve(listing)
    })
    await loadCachedListing("album-twin", "token-aaaaaaaaaaaa", () => {
      loads += 1
      return Promise.resolve(listing)
    })
    assert.equal(loads, 1)
  })

  it("forgets both id and slug aliases", () => {
    clearListingPdpCache()
    rememberCachedListing(listing, "token-aaaaaaaaaaaa")
    forgetCachedListing(listing.id)
    assert.equal(peekCachedListing("album-twin", "token-aaaaaaaaaaaa"), null)
    assert.equal(peekCachedListing(listing.id, "token-aaaaaaaaaaaa"), null)
  })

  it("matches listing params", () => {
    assert.equal(listingMatchesParam(listing, "Album-Twin"), true)
    assert.equal(listingMatchesParam(listing, listing.id.toUpperCase()), true)
    assert.equal(listingMatchesParam(listing, "other"), false)
  })
})
