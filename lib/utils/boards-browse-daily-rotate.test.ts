import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  orderListingIdsForDailyRotate,
  pickRotatedListingIds,
  pickRotatedListingIdsPreferringFresh,
  prependPinnedListingIds,
  previousDailyRotateSeed,
} from "./boards-browse-daily-rotate.ts"

describe("prependPinnedListingIds", () => {
  it("puts curated pins first and keeps the rest in order", () => {
    assert.deepEqual(prependPinnedListingIds(["a", "b", "c", "d"], ["c", "a"]), [
      "c",
      "a",
      "b",
      "d",
    ])
  })

  it("drops pins that are not in the current result set", () => {
    assert.deepEqual(prependPinnedListingIds(["a", "b"], ["z", "b"]), ["b", "a"])
  })

  it("does not promote skipped (suppressed) pins", () => {
    assert.deepEqual(
      prependPinnedListingIds(["a", "b", "c"], ["c", "a"], { skipIds: new Set(["c"]) }),
      ["a", "b", "c"],
    )
  })

  it("is a no-op when nothing is pinned", () => {
    assert.deepEqual(prependPinnedListingIds(["a", "b"], []), ["a", "b"])
  })

  it("dedupes pin ids", () => {
    assert.deepEqual(prependPinnedListingIds(["a", "b", "c"], ["b", "b", "a"]), [
      "b",
      "a",
      "c",
    ])
  })
})

describe("previousDailyRotateSeed", () => {
  it("subtracts one from a numeric seed", () => {
    assert.equal(previousDailyRotateSeed("42"), "41")
  })

  it("floors at zero", () => {
    assert.equal(previousDailyRotateSeed("0"), "0")
    assert.equal(previousDailyRotateSeed("-3"), "0")
  })
})

describe("pickRotatedListingIds", () => {
  const ids = ["a", "b", "c", "d", "e", "f"]

  it("returns a stable slice for the same seed", () => {
    assert.deepEqual(
      pickRotatedListingIds(ids, "100", 3),
      pickRotatedListingIds(ids, "100", 3),
    )
  })

  it("caps at the requested count", () => {
    assert.equal(pickRotatedListingIds(ids, "1", 5).length, 5)
  })

  it("returns all ids when the pool is smaller than count", () => {
    assert.deepEqual(new Set(pickRotatedListingIds(["x", "y"], "1", 5)), new Set(["x", "y"]))
  })

  it("dedupes and drops blank ids", () => {
    assert.deepEqual(pickRotatedListingIds(["a", "a", "", "  "], "1", 5), ["a"])
  })

  it("usually changes order when the seed changes", () => {
    const a = pickRotatedListingIds(ids, "10", 6).join(",")
    const b = pickRotatedListingIds(ids, "11", 6).join(",")
    assert.notEqual(a, b)
  })
})

describe("pickRotatedListingIdsPreferringFresh", () => {
  const ids = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"]

  it("avoids yesterday's picks when the pool is large enough", () => {
    const seed = "200"
    const yesterday = pickRotatedListingIds(ids, previousDailyRotateSeed(seed), 5)
    const today = pickRotatedListingIdsPreferringFresh(ids, seed, 5)
    assert.equal(today.length, 5)
    for (const id of today) {
      assert.equal(yesterday.includes(id), false)
    }
  })

  it("fills from yesterday when fresh inventory is thin", () => {
    const small = ["a", "b", "c", "d", "e", "f"]
    const seed = "200"
    const today = pickRotatedListingIdsPreferringFresh(small, seed, 5)
    assert.equal(today.length, 5)
    assert.deepEqual(new Set(today).size, 5)
  })

  it("is deterministic", () => {
    assert.deepEqual(
      pickRotatedListingIdsPreferringFresh(ids, "77", 5),
      pickRotatedListingIdsPreferringFresh(ids, "77", 5),
    )
  })
})

describe("orderListingIdsForDailyRotate + pins", () => {
  it("keeps pins above a seeded shuffle", () => {
    const rotated = orderListingIdsForDailyRotate(
      [
        { id: "old-1", createdAtMs: 1 },
        { id: "old-2", createdAtMs: 1 },
        { id: "old-3", createdAtMs: 1 },
      ],
      "1",
    )
    const pinned = prependPinnedListingIds(rotated, ["old-3"])
    assert.equal(pinned[0], "old-3")
    assert.deepEqual(new Set(pinned), new Set(rotated))
  })
})
