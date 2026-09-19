import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  buyerAddressFieldsFromCarrierOrLocal,
  buyerResidentialIndicator,
  checkoutPoBoxErrorForSections,
  isBuyerAddressValidationFresh,
  localBuyerAddressFieldsFromInput,
  matchedAddressToBuyerFields,
  normalizeUsPostalCodeForShipping,
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

describe("normalizeUsPostalCodeForShipping", () => {
  it("accepts ZIP and ZIP+4", () => {
    assert.equal(normalizeUsPostalCodeForShipping("93101"), "93101")
    assert.equal(normalizeUsPostalCodeForShipping("93101-4321"), "93101-4321")
    assert.equal(normalizeUsPostalCodeForShipping("931014321"), "93101-4321")
  })

  it("rejects incomplete ZIPs", () => {
    assert.equal(normalizeUsPostalCodeForShipping("9310"), null)
    assert.equal(normalizeUsPostalCodeForShipping(""), null)
  })
})

describe("localBuyerAddressFieldsFromInput", () => {
  it("normalizes a complete US address without carrier confirmation", () => {
    const result = localBuyerAddressFieldsFromInput({
      line1: "  14 Oak Lane ",
      line2: "Apt 2",
      city: "Ojai",
      state: "California",
      postal_code: "93023",
      country: "United States",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.deepEqual(result.fields, {
      line1: "14 Oak Lane",
      line2: "Apt 2",
      city: "Ojai",
      state: "CA",
      postal_code: "93023",
      country: "US",
      residential: "unknown",
    })
  })

  it("accepts military APO states", () => {
    const result = localBuyerAddressFieldsFromInput({
      line1: "PSC 2 Box 1234",
      city: "APO",
      state: "AE",
      postal_code: "09012",
      country: "US",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.fields.state, "AE")
  })

  it("rejects missing state or bad ZIP", () => {
    assert.equal(
      localBuyerAddressFieldsFromInput({
        line1: "14 Oak Lane",
        city: "Ojai",
        postal_code: "93023",
        country: "US",
      }).ok,
      false,
    )
    assert.equal(
      localBuyerAddressFieldsFromInput({
        line1: "14 Oak Lane",
        city: "Ojai",
        state: "CA",
        postal_code: "93",
        country: "US",
      }).ok,
      false,
    )
  })
})

describe("buyerAddressFieldsFromCarrierOrLocal", () => {
  const local = {
    line1: "14 Oak Lane",
    line2: null as string | null,
    city: "Ojai",
    state: "CA",
    postal_code: "93023",
    country: "US",
    residential: "unknown" as const,
  }

  it("uses a carrier match even when status is unverified", () => {
    const fields = buyerAddressFieldsFromCarrierOrLocal(
      {
        status: "unverified",
        messages: [],
        matched: {
          name: "",
          phone: "",
          company_name: "",
          address_line1: "14 OAK LN",
          address_line2: "",
          city_locality: "OJAI",
          state_province: "CA",
          postal_code: "93023-1234",
          country_code: "US",
          residential: "yes",
        },
      },
      local,
    )
    assert.equal(fields.line1, "14 OAK LN")
    assert.equal(fields.postal_code, "93023-1234")
  })

  it("keeps the buyer-entered address when carriers return no match", () => {
    const fields = buyerAddressFieldsFromCarrierOrLocal(
      { status: "unverified", messages: [], matched: null },
      local,
    )
    assert.deepEqual(fields, local)
  })
})
