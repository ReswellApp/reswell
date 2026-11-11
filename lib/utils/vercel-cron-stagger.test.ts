import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { BOARD_BUY_SLA_MINUTES } from "../board-buy/constants.ts"

type VercelCron = { path: string; schedule: string }

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

    assert.ok(fiveMinute.length >= 2, "expected recurring 5-minute jobs")
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

  it("keeps board-buy SLA polling inside the 30-minute quoting window", async () => {
    const crons = await loadCrons()
    const boardBuy = crons.find((cron) => cron.path === "/api/cron/board-buy-sla")
    assert.ok(boardBuy, "board-buy-sla cron must remain scheduled")

    const minutes = sorted(parseCronSchedule(boardBuy.schedule).minutes)
    assert.ok(minutes.length >= 3, "board-buy-sla must poll several times per hour")

    const gaps = minutes.map((minute, index) => {
      const next = minutes[(index + 1) % minutes.length]!
      return (next - minute + 60) % 60 || 60
    })
    const maxGap = Math.max(...gaps)
    assert.ok(
      maxGap <= BOARD_BUY_SLA_MINUTES / 3,
      `board-buy-sla gap of ${maxGap}m is too wide for a ${BOARD_BUY_SLA_MINUTES}m quoting SLA`,
    )
  })

  it("keeps admin analytics rollups and recently-viewed trim scheduled", async () => {
    const crons = await loadCrons()
    const paths = new Set(crons.map((cron) => cron.path))
    assert.ok(paths.has("/api/cron/admin-analytics-rollups"))
    assert.ok(paths.has("/api/cron/trim-recent-listing-views"))
  })
})
