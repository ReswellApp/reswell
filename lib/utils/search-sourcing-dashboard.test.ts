import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buildCumulativeVolume,
  classifySearchInventory,
  fillDailyVolume,
} from "./search-sourcing-dashboard.ts"

describe("classifySearchInventory", () => {
  it("flags zero-result searches as none", () => {
    assert.equal(classifySearchInventory(0), "none")
    assert.equal(classifySearchInventory(-1), "none")
  })

  it("flags low average listings as thin", () => {
    assert.equal(classifySearchInventory(0.4), "thin")
    assert.equal(classifySearchInventory(2.9), "thin")
  })

  it("treats three or more average listings as stocked", () => {
    assert.equal(classifySearchInventory(3), "stocked")
    assert.equal(classifySearchInventory(18), "stocked")
  })

  it("does not flag missing averages as a sourcing gap", () => {
    assert.equal(classifySearchInventory(null), "stocked")
  })
})

describe("fillDailyVolume", () => {
  it("returns empty when there are no dated points", () => {
    assert.deepEqual(fillDailyVolume([], "2026-04-24", "2026-04-26"), [])
  })

  it("fills missing days between the first and last known points", () => {
    assert.deepEqual(
      fillDailyVolume(
        [
          { date: "2026-04-24", count: 2 },
          { date: "2026-04-26", count: 5 },
        ],
        "2026-04-24",
        "2026-04-26",
      ),
      [
        { date: "2026-04-24", count: 2 },
        { date: "2026-04-25", count: 0 },
        { date: "2026-04-26", count: 5 },
      ],
    )
  })
})

describe("buildCumulativeVolume", () => {
  it("returns an empty series for no days", () => {
    assert.deepEqual(buildCumulativeVolume([]), [])
  })

  it("accumulates daily counts in order", () => {
    assert.deepEqual(
      buildCumulativeVolume([
        { date: "2026-09-01", count: 4 },
        { date: "2026-09-02", count: 0 },
        { date: "2026-09-03", count: 11 },
      ]),
      [
        { date: "2026-09-01", count: 4, cumulative: 4 },
        { date: "2026-09-02", count: 0, cumulative: 4 },
        { date: "2026-09-03", count: 11, cumulative: 15 },
      ],
    )
  })
})
