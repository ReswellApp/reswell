import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sellPriceGuidanceToInputValue } from "@/lib/sell-price-guidance-format"
import { resolveSellPriceGuidanceRange } from "@/lib/services/sellPriceGuidance"
import type { PriceGuideConditionBand, PriceGuideTypicalRange } from "@/lib/types/price-guide"

const typical: PriceGuideTypicalRange = {
  low_usd: 400,
  mid_usd: 525,
  high_usd: 650,
  new_retail_usd: 900,
  source: "mixed",
}

const conditionBands: PriceGuideConditionBand[] = [
  {
    condition: "excellent",
    condition_label: "Excellent",
    low_usd: 480,
    mid_usd: 560,
    high_usd: 640,
    sample_count: 7,
  },
  {
    condition: "good",
    condition_label: "Good",
    low_usd: 350,
    mid_usd: 420,
    high_usd: 500,
    sample_count: 4,
  },
]

describe("resolveSellPriceGuidanceRange", () => {
  it("prefers the matching condition band when present", () => {
    const result = resolveSellPriceGuidanceRange({
      condition: "good",
      conditionBands,
      typical,
      soldSampleCount: 12,
    })
    assert.equal(result.match, "condition")
    assert.deepEqual(result.range, {
      low_usd: 350,
      mid_usd: 420,
      high_usd: 500,
    })
    assert.equal(result.sample_count, 4)
    assert.equal(result.condition_label, "Good")
  })

  it("falls back to model typical when condition has no band", () => {
    const result = resolveSellPriceGuidanceRange({
      condition: "fair",
      conditionBands,
      typical,
      soldSampleCount: 12,
    })
    assert.equal(result.match, "model")
    assert.deepEqual(result.range, {
      low_usd: 400,
      mid_usd: 525,
      high_usd: 650,
    })
    assert.equal(result.condition_label, "Fair")
  })

  it("uses model typical when no condition is selected", () => {
    const result = resolveSellPriceGuidanceRange({
      condition: null,
      conditionBands,
      typical,
      soldSampleCount: 3,
    })
    assert.equal(result.match, "model")
    assert.equal(result.range?.mid_usd, 525)
  })

  it("returns unavailable when no range can be built", () => {
    const result = resolveSellPriceGuidanceRange({
      condition: null,
      conditionBands: [],
      typical: {
        low_usd: null,
        mid_usd: null,
        high_usd: null,
        new_retail_usd: null,
        source: "market",
      },
      soldSampleCount: 0,
    })
    assert.equal(result.match, "unavailable")
    assert.equal(result.range, null)
  })
})

describe("sellPriceGuidanceToInputValue", () => {
  it("rounds to whole dollars for the sell input", () => {
    assert.equal(sellPriceGuidanceToInputValue(449.6), "450")
    assert.equal(sellPriceGuidanceToInputValue(0.4), "1")
  })
})
