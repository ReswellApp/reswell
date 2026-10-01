import assert from "node:assert/strict"
import test from "node:test"
import { removeBalanceSheetItemSchema } from "./seller-balance-sheet.ts"

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
