import assert from "node:assert/strict"
import test from "node:test"
import {
  balanceSheetEntryOrder,
  balanceSheetHref,
  balanceSheetPeriodLabel,
  balanceSheetPeriodStart,
} from "./balance-sheet-query.ts"

test("balance sheet defaults to newest first", () => {
  assert.deepEqual(balanceSheetEntryOrder("recent"), [
    { column: "sold_at", ascending: false },
    { column: "entry_key", ascending: false },
  ])
})

test("missing paid price sort lists blank purchase prices before dated rows", () => {
  assert.deepEqual(balanceSheetEntryOrder("missing-paid"), [
    { column: "purchase_price", ascending: true, nullsFirst: true },
    { column: "sold_at", ascending: false },
    { column: "entry_key", ascending: false },
  ])
})

test("balanceSheetHref keeps category, sort, view, period, and page", () => {
  assert.equal(balanceSheetHref({}), "/dashboard/balance-sheet")
  assert.equal(
    balanceSheetHref({
      category: "surfboards",
      sort: "missing-paid",
      page: 2,
      view: "sold",
      period: "month",
    }),
    "/dashboard/balance-sheet?page=2&category=surfboards&sort=missing-paid&view=sold&period=month",
  )
  assert.equal(
    balanceSheetHref({ category: "fins", sort: "recent", view: "all", period: "all" }),
    "/dashboard/balance-sheet?category=fins",
  )
  assert.equal(
    balanceSheetHref({ view: "active", period: "3m" }),
    "/dashboard/balance-sheet?view=active&period=3m",
  )
})

test("balanceSheetPeriodStart returns UTC month start and rolling 3 months", () => {
  const now = new Date("2026-11-06T15:30:00.000Z")
  assert.equal(balanceSheetPeriodStart("all", now), null)
  assert.equal(
    balanceSheetPeriodStart("month", now)?.toISOString(),
    "2026-11-01T00:00:00.000Z",
  )
  assert.equal(
    balanceSheetPeriodStart("3m", now)?.toISOString(),
    "2026-08-06T15:30:00.000Z",
  )
})

test("balanceSheetPeriodLabel names each P&L window", () => {
  assert.equal(balanceSheetPeriodLabel("month"), "This month")
  assert.equal(balanceSheetPeriodLabel("3m"), "Last 3 months")
  assert.equal(balanceSheetPeriodLabel("all"), "All time")
})
