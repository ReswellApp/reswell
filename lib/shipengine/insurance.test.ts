import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isShipEngineLabelInsuranceEnabled,
  shipEngineShipmentInsurance,
} from "./insurance.ts"

describe("ShipEngine insurance", () => {
  it("stays off even when the env flag is true", () => {
    const previous = process.env.SHIPENGINE_LABEL_INSURANCE_ENABLED
    process.env.SHIPENGINE_LABEL_INSURANCE_ENABLED = "true"
    try {
      assert.equal(isShipEngineLabelInsuranceEnabled(), false)
    } finally {
      if (previous === undefined) delete process.env.SHIPENGINE_LABEL_INSURANCE_ENABLED
      else process.env.SHIPENGINE_LABEL_INSURANCE_ENABLED = previous
    }
  })

  it("sends no insurance provider on shipment requests", () => {
    const fields = shipEngineShipmentInsurance()
    assert.equal(fields.insurance_provider, "none")
    assert.equal("insured_value" in fields, false)
  })
})
