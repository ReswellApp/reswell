import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getMobileShippingEstimator, postMobileShippingEstimate } from "./mobileShippingEstimate.ts"

describe("mobile shipping estimator", () => {
  it("returns the website presets and copy", () => {
    const page = getMobileShippingEstimator()
    assert.match(page.title, /Shipping/)
    assert.ok(page.presets.length >= 3)
    assert.ok(page.presets.every((preset) => preset.weight_lb > 0 && preset.length_in > 0))
  })

  it("rejects incomplete estimate input", async () => {
    const result = await postMobileShippingEstimate({ origin_zip: "93101" })
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.status, 400)
  })
})
