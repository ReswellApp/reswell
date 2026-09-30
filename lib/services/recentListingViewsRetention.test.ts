import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  RECENT_LISTING_VIEWS_KEEP_ROWS,
  RECENT_LISTING_VIEWS_MAX_BATCHES,
  RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
  runRecentListingViewsRetention,
} from "./recentListingViewsRetentionPolicy.ts"

describe("runRecentListingViewsRetention", () => {
  it("uses the 100-row retention boundary and stops when no stale rows remain", async () => {
    const calls: Array<{ keepRows: number; deleteLimit: number }> = []

    const summary = await runRecentListingViewsRetention(async (options) => {
      calls.push(options)
      return 0
    })

    assert.equal(RECENT_LISTING_VIEWS_KEEP_ROWS, 100)
    assert.deepEqual(calls, [
      {
        keepRows: 100,
        deleteLimit: RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
      },
    ])
    assert.deepEqual(summary, {
      deleted: 0,
      batches: 1,
      keepRows: 100,
      batchSize: RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
      limitReached: false,
    })
  })

  it("continues after a full batch and stops on a partial batch", async () => {
    const deletes = [RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE, 7]

    const summary = await runRecentListingViewsRetention(async () => deletes.shift() ?? 0)

    assert.equal(summary.deleted, RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE + 7)
    assert.equal(summary.batches, 2)
    assert.equal(summary.limitReached, false)
  })

  it("caps each run and reports a possible backlog", async () => {
    const summary = await runRecentListingViewsRetention(
      async () => RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
    )

    assert.equal(
      summary.deleted,
      RECENT_LISTING_VIEWS_MAX_BATCHES * RECENT_LISTING_VIEWS_TRIM_BATCH_SIZE,
    )
    assert.equal(summary.batches, RECENT_LISTING_VIEWS_MAX_BATCHES)
    assert.equal(summary.limitReached, true)
  })
})
