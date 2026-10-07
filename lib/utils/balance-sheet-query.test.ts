import assert from "node:assert/strict"
import test from "node:test"
import { balanceSheetEntryOrder, balanceSheetHref } from "./balance-sheet-query.ts"

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

test("balanceSheetHref keeps category, sort, and page on the balance sheet", () => {
  assert.equal(balanceSheetHref({}), "/dashboard/balance-sheet")
  assert.equal(
    balanceSheetHref({ category: "surfboards", sort: "missing-paid", page: 2 }),
    "/dashboard/balance-sheet?page=2&category=surfboards&sort=missing-paid",
  )
  assert.equal(
    balanceSheetHref({ category: "fins", sort: "recent" }),
    "/dashboard/balance-sheet?category=fins",
  )
})
