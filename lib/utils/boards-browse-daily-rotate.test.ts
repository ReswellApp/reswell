import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  BOARDS_BROWSE_ROTATE_ID_SCAN_SORT,
  orderListingIdsForDailyRotate,
  prependPinnedListingIds,
  shouldFallbackBoardsBrowseRotate,
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

describe("BOARDS_BROWSE_ROTATE_ID_SCAN_SORT", () => {
  it("uses created_at so the ID scan can hit the public browse index", () => {
    assert.equal(BOARDS_BROWSE_ROTATE_ID_SCAN_SORT, "created-at")
  })
})

describe("shouldFallbackBoardsBrowseRotate", () => {
  it("falls back when the ID scan returns nothing", () => {
    assert.equal(
      shouldFallbackBoardsBrowseRotate({
        idRowCount: 0,
        pageIdCount: 0,
        hydratedCount: 0,
      }),
      true,
    )
  })

  it("falls back when hydrate drops every id on the page", () => {
    assert.equal(
      shouldFallbackBoardsBrowseRotate({
        idRowCount: 40,
        pageIdCount: 30,
        hydratedCount: 0,
      }),
      true,
    )
  })

  it("keeps a successful rotate page", () => {
    assert.equal(
      shouldFallbackBoardsBrowseRotate({
        idRowCount: 40,
        pageIdCount: 30,
        hydratedCount: 30,
      }),
      false,
    )
  })

  it("does not treat an empty trailing page as a failed scan", () => {
    assert.equal(
      shouldFallbackBoardsBrowseRotate({
        idRowCount: 30,
        pageIdCount: 0,
        hydratedCount: 0,
      }),
      false,
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
