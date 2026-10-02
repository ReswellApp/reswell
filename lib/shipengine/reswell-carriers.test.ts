import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  filterToShipEngineWalletCarrierIds,
  restrictShipEngineLabelPayload,
  restrictShipEngineRatesPayload,
  SHIPENGINE_WALLET_CARRIER_IDS,
} from "./reswell-carriers.ts"

describe("filterToShipEngineWalletCarrierIds", () => {
  it("keeps only the One Balance accounts, in allowlist order", () => {
    assert.deepEqual(
      filterToShipEngineWalletCarrierIds([
        "se-6450247",
        "se-6296418",
        "se-6296410",
        "se-9999999",
      ]),
      ["se-6296410", "se-6296418"],
    )
  })

  it("returns nothing when the only connection is a personal UPS account", () => {
    assert.deepEqual(filterToShipEngineWalletCarrierIds(["se-6450247"]), [])
  })
})

describe("restrictShipEngineRatesPayload", () => {
  it("drops a personal UPS id and keeps the wallet carriers that were requested", () => {
    const result = restrictShipEngineRatesPayload({
      rate_options: { carrier_ids: ["se-6450247", "se-6296414"] },
      shipment: { carrier_id: "se-6296414" },
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      (result.payload.rate_options as { carrier_ids: string[] }).carrier_ids,
      ["se-6296414"],
    )
  })

  it("fills a missing carrier list with the four One Balance accounts", () => {
    const result = restrictShipEngineRatesPayload({ shipment: {} })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(
      (result.payload.rate_options as { carrier_ids: string[] }).carrier_ids,
      [...SHIPENGINE_WALLET_CARRIER_IDS],
    )
  })

  it("rejects a rates body that only names a personal UPS account", () => {
    const result = restrictShipEngineRatesPayload({
      rate_options: { carrier_ids: ["se-6450247"] },
    })
    assert.equal(result.ok, false)
  })
})

describe("restrictShipEngineLabelPayload", () => {
  it("rejects a label addressed to a personal UPS account", () => {
    const result = restrictShipEngineLabelPayload({
      shipment: { carrier_id: "se-6450247" },
    })
    assert.equal(result.ok, false)
  })

  it("allows a label on FedEx One Balance", () => {
    const result = restrictShipEngineLabelPayload({
      shipment: { carrier_id: "se-6296416" },
    })
    assert.equal(result.ok, true)
  })
})
