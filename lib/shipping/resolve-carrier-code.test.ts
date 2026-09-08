import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { formatCarrierServiceDisplay } from "./resolve-carrier-code.ts"

describe("formatCarrierServiceDisplay", () => {
  it("turns ups · ups_ground into UPS Ground", () => {
    assert.equal(formatCarrierServiceDisplay("ups · ups_ground"), "UPS Ground")
  })

  it("turns usps_priority_mail into USPS Priority Mail", () => {
    assert.equal(formatCarrierServiceDisplay("usps_priority_mail"), "USPS Priority Mail")
  })

  it("keeps a bare carrier name", () => {
    assert.equal(formatCarrierServiceDisplay("ups"), "UPS")
  })
})
