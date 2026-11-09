import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatCarrierServiceDisplay,
  resolveShipEngineCarrierCode,
  shipEngineCarrierCodesToTry,
} from "./resolve-carrier-code.ts"

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

describe("resolveShipEngineCarrierCode", () => {
  it("reads the carrier from a service-only blob", () => {
    assert.equal(resolveShipEngineCarrierCode("1Z999AA10123456784", "ups_ground"), "ups")
    assert.equal(
      resolveShipEngineCarrierCode("9400111899223197428490", "usps_priority_mail"),
      "usps",
    )
  })
})

describe("shipEngineCarrierCodesToTry", () => {
  it("tries stamps_com then usps for ShipEngine USPS labels", () => {
    assert.deepEqual(
      shipEngineCarrierCodesToTry("9400111899223197428490", "stamps_com · usps_priority_mail"),
      ["stamps_com", "usps"],
    )
  })
})
