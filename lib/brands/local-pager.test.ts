import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { localPagerPageNumbers, localPagerRangeLabel } from "./local-pager.ts"

describe("localPagerPageNumbers", () => {
  it("returns consecutive pages when total fits the window", () => {
    assert.deepEqual(localPagerPageNumbers(1, 4), [1, 2, 3, 4])
  })

  it("slides the window around the current page", () => {
    assert.deepEqual(localPagerPageNumbers(1, 10, 5), [1, 2, 3, 4, 5])
    assert.deepEqual(localPagerPageNumbers(6, 10, 5), [4, 5, 6, 7, 8])
    assert.deepEqual(localPagerPageNumbers(10, 10, 5), [6, 7, 8, 9, 10])
  })
})

describe("localPagerRangeLabel", () => {
  it("formats the visible slice", () => {
    assert.equal(localPagerRangeLabel(1, 12, 111), "Showing 1–12 of 111")
    assert.equal(localPagerRangeLabel(10, 12, 111), "Showing 109–111 of 111")
    assert.equal(localPagerRangeLabel(1, 12, 1), "Showing 1 of 1")
  })
})
