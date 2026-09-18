import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatShipEngineAddressValidationError,
  parseResidentialIndicator,
  parseShipEngineAddressValidation,
  parseShipEngineMatchedAddress,
  shipEngineAddressValidationIsAcceptable,
} from "./validate-address-parse.ts"

describe("parseResidentialIndicator", () => {
  it("keeps yes/no/unknown", () => {
    assert.equal(parseResidentialIndicator("yes"), "yes")
    assert.equal(parseResidentialIndicator("NO"), "no")
    assert.equal(parseResidentialIndicator("unknown"), "unknown")
  })

  it("falls back to unknown", () => {
    assert.equal(parseResidentialIndicator(null), "unknown")
    assert.equal(parseResidentialIndicator("commercial"), "unknown")
  })
})

describe("parseShipEngineAddressValidation", () => {
  it("reads a verified residential match", () => {
    const parsed = parseShipEngineAddressValidation([
      {
        status: "verified",
        messages: [{ message: "Address found" }],
        matched_address: {
          name: "Hayden",
          address_line1: "123 MAIN ST",
          address_line2: "APT 2",
          city_locality: "SANTA BARBARA",
          state_province: "CA",
          postal_code: "93101-1234",
          country_code: "US",
          address_residential_indicator: "yes",
        },
      },
    ])
    assert.equal(parsed.status, "verified")
    assert.equal(parsed.matched?.address_line1, "123 MAIN ST")
    assert.equal(parsed.matched?.postal_code, "93101-1234")
    assert.equal(parsed.matched?.residential, "yes")
    assert.equal(shipEngineAddressValidationIsAcceptable(parsed), true)
  })

  it("accepts warning when a match is present", () => {
    const parsed = parseShipEngineAddressValidation({
      status: "warning",
      matched_address: {
        address_line1: "100 STATE ST",
        city_locality: "SANTA BARBARA",
        state_province: "California",
        postal_code: "93101",
        country_code: "US",
        address_residential_indicator: "no",
      },
    })
    assert.equal(parsed.status, "warning")
    assert.equal(parsed.matched?.state_province, "CA")
    assert.equal(parsed.matched?.residential, "no")
    assert.equal(shipEngineAddressValidationIsAcceptable(parsed), true)
  })

  it("rejects unverified and missing matches", () => {
    const unverified = parseShipEngineAddressValidation({ status: "unverified" })
    assert.equal(unverified.status, "unverified")
    assert.equal(shipEngineAddressValidationIsAcceptable(unverified), false)
    assert.match(formatShipEngineAddressValidationError(unverified), /could not verify/i)

    const noStreet = parseShipEngineMatchedAddress({
      city_locality: "Santa Barbara",
      postal_code: "93101",
    })
    assert.equal(noStreet, null)
  })
})
