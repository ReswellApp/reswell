import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buyerResidentialIndicator,
  checkoutPoBoxErrorForSections,
  isBuyerAddressValidationFresh,
  matchedAddressToBuyerFields,
} from "./buyer-address-validation.ts"
import { UPS_FEDEX_PO_BOX_ERROR } from "./peer-checkout-usps-services.ts"

describe("buyerResidentialIndicator", () => {
  it("keeps explicit carrier values", () => {
    assert.equal(buyerResidentialIndicator("no"), "no")
    assert.equal(buyerResidentialIndicator("unknown"), "unknown")
  })

  it("defaults missing legacy rows to residential", () => {
    assert.equal(buyerResidentialIndicator(null), "yes")
    assert.equal(buyerResidentialIndicator(undefined), "yes")
  })
})

describe("isBuyerAddressValidationFresh", () => {
  it("treats empty or stale timestamps as stale", () => {
    const now = Date.parse("2026-09-17T18:00:00.000Z")
    assert.equal(isBuyerAddressValidationFresh(null, now), false)
    assert.equal(isBuyerAddressValidationFresh("2026-08-01T18:00:00.000Z", now), false)
    assert.equal(isBuyerAddressValidationFresh("2026-09-10T18:00:00.000Z", now), true)
  })
})

describe("checkoutPoBoxErrorForSections", () => {
  it("blocks PO Boxes for surfboards (UPS/FedEx)", () => {
    assert.equal(
      checkoutPoBoxErrorForSections({ line1: "PO Box 123", line2: null }, ["surfboards"]),
      UPS_FEDEX_PO_BOX_ERROR,
    )
  })

  it("allows PO Boxes for USPS-only carts", () => {
    assert.equal(
      checkoutPoBoxErrorForSections({ line1: "PO Box 123", line2: null }, ["fins"]),
      null,
    )
    assert.equal(
      checkoutPoBoxErrorForSections({ line1: "PO Box 123", line2: null }, ["magazines"]),
      null,
    )
  })

  it("blocks mixed surfboard + USPS carts", () => {
    assert.equal(
      checkoutPoBoxErrorForSections({ line1: "Box 88", line2: null }, ["surfboards", "fins"]),
      UPS_FEDEX_PO_BOX_ERROR,
    )
  })

  it("leaves street addresses alone", () => {
    assert.equal(
      checkoutPoBoxErrorForSections({ line1: "123 Main St", line2: "Apt 2" }, ["surfboards"]),
      null,
    )
  })
})

describe("matchedAddressToBuyerFields", () => {
  it("maps ShipEngine match fields", () => {
    const fields = matchedAddressToBuyerFields({
      name: "Hayden",
      phone: "8055551212",
      company_name: "",
      address_line1: "123 MAIN ST",
      address_line2: "",
      city_locality: "SANTA BARBARA",
      state_province: "CA",
      postal_code: "93101-4321",
      country_code: "US",
      residential: "no",
    })
    assert.deepEqual(fields, {
      line1: "123 MAIN ST",
      line2: null,
      city: "SANTA BARBARA",
      state: "CA",
      postal_code: "93101-4321",
      country: "US",
      residential: "no",
    })
  })
})
