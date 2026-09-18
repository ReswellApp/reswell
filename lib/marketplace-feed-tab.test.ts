import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  marketplaceFeedHref,
  sliceMarketplaceFeedPage,
} from "./marketplace-feed-tab.ts"

describe("marketplaceFeedHref", () => {
  it("includes page on the shipped tab", () => {
    assert.equal(marketplaceFeedHref("shipped"), "/sold?tab=shipped")
    assert.equal(marketplaceFeedHref("shipped", { page: 1 }), "/sold?tab=shipped")
    assert.equal(marketplaceFeedHref("shipped", { page: 2 }), "/sold?tab=shipped&page=2")
    assert.equal(
      marketplaceFeedHref("shipped", { brandSlug: "lost", page: 3 }),
      "/sold?tab=shipped&brandSlug=lost&page=3",
    )
  })
})

describe("sliceMarketplaceFeedPage", () => {
  const ids = ["a", "b", "c", "d", "e"]

  it("returns the requested page and a real total", () => {
    const first = sliceMarketplaceFeedPage(ids, 1, 2)
    assert.deepEqual(first.pageItems, ["a", "b"])
    assert.equal(first.page, 1)
    assert.equal(first.totalCount, 5)
    assert.equal(first.totalPages, 3)

    const last = sliceMarketplaceFeedPage(ids, 3, 2)
    assert.deepEqual(last.pageItems, ["e"])
    assert.equal(last.totalPages, 3)
  })

  it("returns an empty page past the end so the route can redirect", () => {
    const pastEnd = sliceMarketplaceFeedPage(ids, 9, 2)
    assert.deepEqual(pastEnd.pageItems, [])
    assert.equal(pastEnd.page, 9)
    assert.equal(pastEnd.totalPages, 3)
  })
})
