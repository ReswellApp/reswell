import assert from "node:assert/strict"
import test from "node:test"
import {
  balanceSheetPeriodSchema,
  balanceSheetSortSchema,
  balanceSheetViewSchema,
  removeBalanceSheetItemSchema,
} from "./seller-balance-sheet.ts"

test("balanceSheetSortSchema accepts missing paid price and defaults anything else to recent", () => {
  assert.equal(balanceSheetSortSchema.parse("missing-paid"), "missing-paid")
  assert.equal(balanceSheetSortSchema.parse("recent"), "recent")
  assert.equal(balanceSheetSortSchema.parse(undefined), "recent")
  assert.equal(balanceSheetSortSchema.parse("price"), "recent")
})

test("balanceSheetViewSchema accepts active/sold and defaults unknown values to all", () => {
  assert.equal(balanceSheetViewSchema.parse("active"), "active")
  assert.equal(balanceSheetViewSchema.parse("sold"), "sold")
  assert.equal(balanceSheetViewSchema.parse("all"), "all")
  assert.equal(balanceSheetViewSchema.parse(undefined), "all")
  assert.equal(balanceSheetViewSchema.parse("inventory"), "all")
})

test("balanceSheetPeriodSchema accepts month/3m/all and defaults unknown values to all", () => {
  assert.equal(balanceSheetPeriodSchema.parse("month"), "month")
  assert.equal(balanceSheetPeriodSchema.parse("3m"), "3m")
  assert.equal(balanceSheetPeriodSchema.parse("all"), "all")
  assert.equal(balanceSheetPeriodSchema.parse(undefined), "all")
  assert.equal(balanceSheetPeriodSchema.parse("year"), "all")
})

test("removeBalanceSheetItemSchema accepts a listing UUID", () => {
  const result = removeBalanceSheetItemSchema.safeParse({
    listingId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  })

  assert.equal(result.success, true)
})

test("removeBalanceSheetItemSchema rejects a non-UUID listing id", () => {
  const result = removeBalanceSheetItemSchema.safeParse({
    listingId: "not-a-listing-id",
  })

  assert.equal(result.success, false)
})
