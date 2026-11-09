import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { formatUsd } from "./format-usd.ts"

describe("formatUsd", () => {
  it("keeps cents and groups thousands", () => {
    assert.equal(formatUsd(0), "$0.00")
    assert.equal(formatUsd(1240.5), "$1,240.50")
    assert.equal(formatUsd(Number.NaN), "$0.00")
  })
})
