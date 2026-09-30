import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  ADMIN_ANALYTICS_RETENTION_DAYS,
  analyticsRetentionCutoff,
  isAdminAnalyticsRawPruningEnabled,
} from "./admin-rollup-policy.ts"

describe("admin analytics retention policy", () => {
  it("keeps raw pruning disabled unless explicitly enabled", () => {
    assert.equal(isAdminAnalyticsRawPruningEnabled(undefined), false)
    assert.equal(isAdminAnalyticsRawPruningEnabled(""), false)
    assert.equal(isAdminAnalyticsRawPruningEnabled("false"), false)
    assert.equal(isAdminAnalyticsRawPruningEnabled("TRUE"), false)
    assert.equal(isAdminAnalyticsRawPruningEnabled("true"), true)
  })

  it("keeps longer raw retention for Klaviyo than site traffic", () => {
    assert.equal(ADMIN_ANALYTICS_RETENTION_DAYS.site_traffic, 45)
    assert.equal(ADMIN_ANALYTICS_RETENTION_DAYS.klaviyo_event_log, 90)

    const now = new Date("2026-09-30T15:00:00.000Z")
    assert.equal(
      analyticsRetentionCutoff("site_traffic", now),
      "2026-08-16T15:00:00.000Z",
    )
    assert.equal(
      analyticsRetentionCutoff("klaviyo_event_log", now),
      "2026-07-02T15:00:00.000Z",
    )
  })

  it("coverage-gates both bounded raw deletion paths", async () => {
    const migration = await readFile(
      new URL(
        "../../supabase/migrations/20271008120000_admin_analytics_daily_rollups.sql",
        import.meta.url,
      ),
      "utf8",
    )

    assert.match(
      migration,
      /CREATE OR REPLACE FUNCTION public\.prune_admin_analytics_raw/,
    )
    assert.equal(
      migration.match(/admin_analytics_rollup_coverage c/g)?.length,
      5,
    )
    assert.match(migration, /LIMIT v_limit/)
    assert.match(migration, /only completed UTC dates may be rolled up/)
  })

  it("keeps scheduled backfill separate from raw pruning", async () => {
    const rollupRoute = await readFile(
      new URL(
        "../../app/api/cron/admin-analytics-rollups/route.ts",
        import.meta.url,
      ),
      "utf8",
    )
    const flowStatsRoute = await readFile(
      new URL(
        "../../app/api/cron/klaviyo-flow-stats/route.ts",
        import.meta.url,
      ),
      "utf8",
    )

    assert.match(rollupRoute, /ADMIN_ANALYTICS_RAW_PRUNING_ENABLED/)
    assert.match(rollupRoute, /isAdminAnalyticsRawPruningEnabled/)
    assert.doesNotMatch(flowStatsRoute, /pruneEventLog/)
  })
})
