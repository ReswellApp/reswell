import assert from "node:assert/strict"
import { readdir, readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  ADMIN_ANALYTICS_RETENTION_DAYS,
  analyticsRetentionCutoff,
  isAdminAnalyticsRawPruningEnabled,
} from "./admin-rollup-policy.ts"

const migrationsUrl = new URL("../../supabase/migrations", import.meta.url)

async function migrationFilenames(): Promise<string[]> {
  return (await readdir(migrationsUrl)).filter((filename) =>
    filename.endsWith(".sql"),
  )
}

function versionPrefix(filename: string): string | undefined {
  return filename.match(/^(\d+)_/)?.[1]
}

async function readMigrationBySuffix(suffix: string): Promise<{
  filename: string
  version: string
  sql: string
}> {
  const filename = (await migrationFilenames()).find((entry) =>
    entry.endsWith(suffix),
  )
  assert.ok(filename, `missing migration ${suffix}`)
  const version = versionPrefix(filename)
  assert.ok(version, `migration ${filename} has no version prefix`)
  const sql = await readFile(new URL(`../../supabase/migrations/${filename}`, import.meta.url), "utf8")
  return { filename, version, sql }
}

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
    const { sql: migration } = await readMigrationBySuffix(
      "_admin_analytics_daily_rollups.sql",
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
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public\.site_traffic_daily/)
    assert.match(migration, /NOTIFY pgrst, 'reload schema'/)
    assert.doesNotMatch(migration, /now\(\) AS current_time/)
    assert.match(migration, /now\(\) AS as_of/)
    assert.match(migration, /p\.as_of/)
    assert.match(migration, /w\.as_of/)
  })

  it("keeps scheduled backfill separate from raw pruning", async () => {
    const rollupRoute = await readFile(
      new URL(
        "../../app/api/cron/admin-analytics-rollups/route.ts",
        import.meta.url,
      ),
      "utf8",
    )
    const trimRoute = await readFile(
      new URL(
        "../../app/api/cron/trim-recent-listing-views/route.ts",
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
    const envExample = await readFile(
      new URL("../../.env.example", import.meta.url),
      "utf8",
    )

    assert.match(rollupRoute, /ADMIN_ANALYTICS_RAW_PRUNING_ENABLED/)
    assert.match(rollupRoute, /isAdminAnalyticsRawPruningEnabled/)
    assert.match(rollupRoute, /isCronRequestAuthorized/)
    assert.match(trimRoute, /isCronRequestAuthorized/)
    assert.match(trimRoute, /trim_user_recently_viewed_listings|trimRecentListingViewsRetention/)
    assert.doesNotMatch(flowStatsRoute, /pruneEventLog/)
    assert.match(
      envExample,
      /^ADMIN_ANALYTICS_RAW_PRUNING_ENABLED=false$/m,
    )

    const vercelConfig = JSON.parse(
      await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
    ) as { crons?: Array<{ path?: string }> }
    assert.ok(
      vercelConfig.crons?.some(
        (cron) => cron.path === "/api/cron/admin-analytics-rollups",
      ),
    )
    assert.ok(
      vercelConfig.crons?.some(
        (cron) => cron.path === "/api/cron/trim-recent-listing-views",
      ),
    )
  })

  it("keeps analytics and retention migration versions unique against the full ledger", async () => {
    const migrations = await migrationFilenames()
    const filesByVersion = new Map<string, string[]>()
    for (const filename of migrations) {
      const version = versionPrefix(filename)
      if (!version) continue
      const group = filesByVersion.get(version) ?? []
      group.push(filename)
      filesByVersion.set(version, group)
    }

    const rollup = await readMigrationBySuffix("_admin_analytics_daily_rollups.sql")
    const repair = await readMigrationBySuffix(
      "_admin_analytics_rollup_dashboard_as_of.sql",
    )
    const retention = await readMigrationBySuffix(
      "_async_recently_viewed_retention.sql",
    )
    const geo = await readMigrationBySuffix("_boards_browse_geo_fallback_rpc.sql")
    const balanceSheet = await readMigrationBySuffix(
      "_balance_sheet_item_exclusions.sql",
    )

    assert.notEqual(rollup.version, "20271008120000")
    assert.equal(balanceSheet.version, "20271008120000")
    assert.ok(repair.version > rollup.version, repair.filename)
    assert.equal(filesByVersion.get(rollup.version)?.length, 1, rollup.filename)
    assert.equal(filesByVersion.get(repair.version)?.length, 1, repair.filename)
    assert.equal(filesByVersion.get(retention.version)?.length, 1, retention.filename)
    assert.equal(filesByVersion.get(geo.version)?.length, 1, geo.filename)
    assert.equal(
      new Set([rollup.version, repair.version, retention.version, geo.version]).size,
      4,
    )
    assert.doesNotMatch(repair.sql, /now\(\) AS current_time/)
    assert.match(repair.sql, /now\(\) AS as_of/)
    assert.match(
      repair.sql,
      /CREATE OR REPLACE FUNCTION public\.admin_site_traffic_dashboard/,
    )
    assert.match(
      repair.sql,
      /CREATE OR REPLACE FUNCTION public\.klaviyo_event_log_analytics/,
    )
    assert.match(repair.sql, /NOTIFY pgrst, 'reload schema'/)
  })
})
