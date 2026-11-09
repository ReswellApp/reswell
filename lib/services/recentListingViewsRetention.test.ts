import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
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

  it("keeps the async trim RPC bounded and service-role only", async () => {
    const migration = await readFile(
      new URL(
        "../../supabase/migrations/20271007120000_async_recently_viewed_retention.sql",
        import.meta.url,
      ),
      "utf8",
    )

    assert.match(
      migration,
      /CREATE OR REPLACE FUNCTION public\.trim_user_recently_viewed_listings/,
    )
    assert.match(migration, /LIMIT p_delete_limit/)
    assert.match(migration, /p_delete_limit must be between 1 and 5000/)
    assert.match(
      migration,
      /GRANT EXECUTE ON FUNCTION public\.trim_user_recently_viewed_listings\(integer, integer\)\s+TO service_role/,
    )
    assert.match(migration, /NOTIFY pgrst, 'reload schema'/)
    assert.doesNotMatch(migration, /DELETE FROM public\.user_recently_viewed_listings[\s\S]*auth\.uid/)
  })
})
