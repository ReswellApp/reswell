import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

type VercelCron = { path: string; schedule: string }

/** Marketplace growth jobs. Unscheduled while the public site is closed. */
const PAUSED_WHILE_CLOSED = [
  "/api/cron/klaviyo-inactivity-milestones",
  "/api/cron/klaviyo-unfinished-listings",
  "/api/cron/klaviyo-catalog-sync",
  "/api/cron/seller-message-inactivity",
  "/api/cron/newsletter-promo-expiration-nudge",
  "/api/cron/klaviyo-favorites-digest",
  "/api/cron/klaviyo-flow-stats",
  "/api/cron/admin-analytics-rollups",
  "/api/cron/board-buy-sla",
  "/api/cron/google-merchant-refresh",
  "/api/cron/elasticsearch-reindex",
  "/api/cron/search-insights-digest",
  "/api/cron/search-daily-report",
  "/api/cron/search-period-report",
  "/api/cron/backfill-listing-brand-model",
  "/api/cron/auto-price-drop",
  "/api/cron/notification-fanout",
  "/api/cron/listing-image-storage-drift",
  "/api/cron/surfboard-dimension-photo-queue",
] as const

const FIELD_BOUNDS = [
  [0, 59],
  [0, 23],
  [1, 31],
  [1, 12],
  [0, 6],
] as const

function parseCronField(field: string, min: number, max: number): Set<number> {
  const values = new Set<number>()
  for (const part of field.split(",")) {
    const [rangeToken, stepToken] = part.split("/")
    const step = stepToken ? Number(stepToken) : 1
    if (!Number.isInteger(step) || step < 1) {
      throw new Error(`Invalid cron step in "${field}"`)
    }

    let start = min
    let end = max
    if (rangeToken !== "*") {
      const bounds = rangeToken.split("-").map(Number)
      start = bounds[0] ?? Number.NaN
      end = bounds.length > 1 ? (bounds[1] ?? start) : start
    }
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) {
      throw new Error(`Invalid cron range "${rangeToken}" in "${field}"`)
    }
    for (let value = start; value <= end; value += step) values.add(value)
  }
  return values
}

function parseCronSchedule(schedule: string) {
  const fields = schedule.trim().split(/\s+/)
  if (fields.length !== 5) {
    throw new Error(`Expected 5 cron fields, got "${schedule}"`)
  }
  return {
    minutes: parseCronField(fields[0]!, ...FIELD_BOUNDS[0]),
    hours: parseCronField(fields[1]!, ...FIELD_BOUNDS[1]),
    daysOfMonth: parseCronField(fields[2]!, ...FIELD_BOUNDS[2]),
    months: parseCronField(fields[3]!, ...FIELD_BOUNDS[3]),
    daysOfWeek: parseCronField(fields[4]!, ...FIELD_BOUNDS[4]),
    minuteWild: fields[0] === "*",
    hourWild: fields[1] === "*",
    dayOfMonthWild: fields[2] === "*",
    dayOfWeekWild: fields[4] === "*",
  }
}

function cronMatchesUtc(schedule: ReturnType<typeof parseCronSchedule>, at: Date): boolean {
  if (!schedule.minutes.has(at.getUTCMinutes())) return false
  if (!schedule.hours.has(at.getUTCHours())) return false
  if (!schedule.months.has(at.getUTCMonth() + 1)) return false

  const dayOfMonth = at.getUTCDate()
  const dayOfWeek = at.getUTCDay()
  if (schedule.dayOfMonthWild && schedule.dayOfWeekWild) return true
  if (schedule.dayOfMonthWild) return schedule.daysOfWeek.has(dayOfWeek)
  if (schedule.dayOfWeekWild) return schedule.daysOfMonth.has(dayOfMonth)
  return schedule.daysOfMonth.has(dayOfMonth) || schedule.daysOfWeek.has(dayOfWeek)
}

function sorted(values: Iterable<number>): number[] {
  return [...values].sort((a, b) => a - b)
}

function isEveryNMinutes(minutes: number[], interval: number): boolean {
  if (minutes.length !== 60 / interval) return false
  return minutes.every((minute, index) => minute === minutes[0]! + index * interval)
}

async function loadCrons(): Promise<VercelCron[]> {
  const vercelConfig = JSON.parse(
    await readFile(new URL("../../vercel.json", import.meta.url), "utf8"),
  ) as { crons?: VercelCron[] }
  assert.ok(vercelConfig.crons?.length, "vercel.json must define crons")
  return vercelConfig.crons
}

describe("vercel cron stagger", () => {
  it("keeps 5-minute and 15-minute jobs off the same minute", async () => {
    const crons = await loadCrons()
    const fiveMinute = crons.filter((cron) => {
      const parsed = parseCronSchedule(cron.schedule)
      return parsed.hourWild && isEveryNMinutes(sorted(parsed.minutes), 5)
    })
    const fifteenMinute = crons.filter((cron) => {
      const parsed = parseCronSchedule(cron.schedule)
      return parsed.hourWild && isEveryNMinutes(sorted(parsed.minutes), 15)
    })

    assert.equal(
      fiveMinute.length,
      1,
      "shopify sync is the only 5-minute job left while the marketplace is closed",
    )
    assert.ok(fifteenMinute.length >= 3, "expected recurring 15-minute jobs")

    for (const five of fiveMinute) {
      const fiveMinutes = parseCronSchedule(five.schedule).minutes
      for (const fifteen of fifteenMinute) {
        const overlap = [...parseCronSchedule(fifteen.schedule).minutes].filter((minute) =>
          fiveMinutes.has(minute),
        )
        assert.deepEqual(
          overlap,
          [],
          `${five.path} (${five.schedule}) shares minutes ${overlap.join(",")} with ${fifteen.path} (${fifteen.schedule})`,
        )
      }
    }
  })

  it("clears the old :00/:15 start clusters", async () => {
    const crons = await loadCrons()
    const parsed = crons.map((cron) => ({ ...cron, parsed: parseCronSchedule(cron.schedule) }))

    const clusterSize = (minute: number) =>
      parsed.filter(
        (cron) => cron.parsed.hourWild && cron.parsed.minutes.has(minute),
      ).length

    assert.ok(
      clusterSize(0) <= 2,
      `recurring jobs at :00 should not cluster, found ${clusterSize(0)}`,
    )
    assert.ok(
      clusterSize(15) <= 2,
      `recurring jobs at :15 should not cluster, found ${clusterSize(15)}`,
    )

    const start = Date.UTC(2026, 0, 1)
    const end = Date.UTC(2026, 1, 1)
    const counts = new Map<number, string[]>()
    for (let ts = start; ts < end; ts += 60_000) {
      const at = new Date(ts)
      const firing = parsed
        .filter((cron) => cronMatchesUtc(cron.parsed, at))
        .map((cron) => cron.path)
      if (firing.length > 0) counts.set(ts, firing)
    }

    const worst = [...counts.entries()].reduce(
      (max, entry) => (entry[1].length > max[1].length ? entry : max),
      [0, [] as string[]],
    )
    assert.ok(
      worst[1].length <= 3,
      `expected at most 3 jobs per minute, found ${worst[1].length} at ${new Date(worst[0]).toISOString()}: ${worst[1].join(", ")}`,
    )

    for (const [ts, paths] of counts) {
      const minute = new Date(ts).getUTCMinutes()
      if (minute !== 0 && minute !== 15) continue
      assert.ok(
        paths.length <= 2,
        `minute :${String(minute).padStart(2, "0")} cluster returned at ${new Date(ts).toISOString()}: ${paths.join(", ")}`,
      )
    }
  })

  it("leaves marketplace growth jobs unscheduled while the site is closed", async () => {
    const crons = await loadCrons()
    const paths = new Set(crons.map((cron) => cron.path))
    for (const path of PAUSED_WHILE_CLOSED) {
      assert.equal(paths.has(path), false, `${path} should stay unscheduled`)
    }
    assert.ok(paths.has("/api/cron/shopify-sync"))
    assert.ok(paths.has("/api/cron/release-carrier-delivered-payouts"))
    assert.ok(paths.has("/api/cron/sync-open-carrier-tracking"))
    assert.ok(paths.has("/api/cron/refund-after-return-delivered"))
    assert.ok(paths.has("/api/cron/support-case-backfill"))
    assert.ok(paths.has("/api/cron/trim-recent-listing-views"))
  })
})
