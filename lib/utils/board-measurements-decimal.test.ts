import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatInchesDecimalDisplay, parseBoardMeasurement } from "../board-measurements.ts"

describe("formatInchesDecimalDisplay", () => {
  it("converts the sell-picker fraction steps to decimals", () => {
    assert.equal(formatInchesDecimalDisplay(19.75), '19.75"')
    assert.equal(formatInchesDecimalDisplay(19 + 7 / 8), '19.875"')
    assert.equal(formatInchesDecimalDisplay(2.5), '2.5"')
    assert.equal(formatInchesDecimalDisplay(2 + 1 / 16), '2.0625"')
    assert.equal(formatInchesDecimalDisplay(20), '20"')
  })

  it("matches parseBoardMeasurement of stored fraction values", () => {
    const stored = ["19 3/4", "19 1/8", "2 1/2", "2 1/16", "15"]
    const expected = ['19.75"', '19.125"', '2.5"', '2.0625"', '15"']
    for (let i = 0; i < stored.length; i++) {
      const n = parseBoardMeasurement(stored[i])
      assert.ok(n != null)
      assert.equal(formatInchesDecimalDisplay(n), expected[i])
    }
  })
})
