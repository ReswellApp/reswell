import assert from "node:assert/strict"
import { describe, it } from "node:test"

import type { AdminAnalyticsRollupSource } from "@/lib/db/adminAnalyticsRollups"

import {
  ADMIN_ANALYTICS_BACKFILL_DAYS_PER_SOURCE,
  ADMIN_ANALYTICS_PRUNE_BATCH_SIZE,
  ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE,
  runAdminAnalyticsRollupsWithStore,
  type AdminAnalyticsRollupStore,
} from "./adminAnalyticsRollupsPolicy.ts"

function recordingStore(options: {
  pending: Record<AdminAnalyticsRollupSource, string[]>
  pruneDeleted?: (source: AdminAnalyticsRollupSource, batch: number) => number
}): {
  store: AdminAnalyticsRollupStore
  pruneCalls: Array<{ source: AdminAnalyticsRollupSource; before: string; limit: number }>
  listLimits: number[]
} {
  const pruneCalls: Array<{
    source: AdminAnalyticsRollupSource
    before: string
    limit: number
  }> = []
  const listLimits: number[] = []
  const pruneBatches: Record<AdminAnalyticsRollupSource, number> = {
    site_traffic: 0,
    klaviyo_event_log: 0,
  }

  const store: AdminAnalyticsRollupStore = {
    async listPendingDays(source, limit) {
      listLimits.push(limit)
      return options.pending[source]
    },
    async refreshDay(source, rollupDate) {
      return { source, rollupDate, sourceRows: 12 }
    },
    async pruneRawBatch(source, before, limit) {
      pruneCalls.push({ source, before, limit })
      const batch = pruneBatches[source]
      pruneBatches[source] += 1
      return options.pruneDeleted?.(source, batch) ?? 0
    },
  }

  return { store, pruneCalls, listLimits }
}

describe("runAdminAnalyticsRollupsWithStore", () => {
  it("backfills pending days and never prunes unless opt-in", async () => {
    const { store, pruneCalls, listLimits } = recordingStore({
      pending: {
        site_traffic: ["2026-10-01", "2026-10-02"],
        klaviyo_event_log: ["2026-09-15"],
      },
    })

    const summary = await runAdminAnalyticsRollupsWithStore(
      store,
      new Date("2026-11-09T15:00:00.000Z"),
    )

    assert.equal(summary.pruningEnabled, false)
    assert.deepEqual(summary.pruned, { site_traffic: 0, klaviyo_event_log: 0 })
    assert.deepEqual(summary.pruneLimitReached, [])
    assert.deepEqual(pruneCalls, [])
    assert.deepEqual(
      listLimits,
      [
        ADMIN_ANALYTICS_BACKFILL_DAYS_PER_SOURCE,
        ADMIN_ANALYTICS_BACKFILL_DAYS_PER_SOURCE,
      ],
    )
    assert.deepEqual(
      summary.rolledUp.map((row) => `${row.source}:${row.rollupDate}:${row.sourceRows}`),
      [
        "site_traffic:2026-10-01:12",
        "site_traffic:2026-10-02:12",
        "klaviyo_event_log:2026-09-15:12",
      ],
    )
  })

  it("keeps enabled pruning bounded per source", async () => {
    const { store, pruneCalls } = recordingStore({
      pending: { site_traffic: [], klaviyo_event_log: [] },
      pruneDeleted: (source) =>
        source === "site_traffic" ? ADMIN_ANALYTICS_PRUNE_BATCH_SIZE : 3,
    })

    const summary = await runAdminAnalyticsRollupsWithStore(
      store,
      new Date("2026-11-09T15:00:00.000Z"),
      { pruneRaw: true },
    )

    assert.equal(summary.pruningEnabled, true)
    assert.equal(
      summary.pruned.site_traffic,
      ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE * ADMIN_ANALYTICS_PRUNE_BATCH_SIZE,
    )
    assert.equal(summary.pruned.klaviyo_event_log, 3)
    assert.deepEqual(summary.pruneLimitReached, ["site_traffic"])
    assert.equal(
      pruneCalls.length,
      ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE + 1,
    )
    assert.ok(
      pruneCalls.every((call) => call.limit === ADMIN_ANALYTICS_PRUNE_BATCH_SIZE),
    )
    assert.equal(pruneCalls[0]?.before, "2026-09-25T15:00:00.000Z")
    assert.equal(
      pruneCalls[ADMIN_ANALYTICS_PRUNE_BATCHES_PER_SOURCE]?.before,
      "2026-08-11T15:00:00.000Z",
    )
  })
})
