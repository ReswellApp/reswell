import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatGmv } from "./format-gmv.ts"

describe("formatGmv", () => {
  it("shows whole dollars with thousands separators", () => {
    assert.equal(formatGmv(100_750), "$100,750")
    assert.equal(formatGmv(100_000), "$100,000")
    assert.equal(formatGmv(100_750.4), "$100,750")
    assert.equal(formatGmv(100_750.6), "$100,751")
    assert.equal(formatGmv(1_234_567), "$1,234,567")
    assert.equal(formatGmv(999.4), "$999")
    assert.equal(formatGmv(999.6), "$1,000")
  })

  it("treats empty and invalid amounts as zero", () => {
    assert.equal(formatGmv(0), "$0")
    assert.equal(formatGmv(-12), "$0")
    assert.equal(formatGmv(Number.NaN), "$0")
    assert.equal(formatGmv(Number.POSITIVE_INFINITY), "$0")
  })
})
