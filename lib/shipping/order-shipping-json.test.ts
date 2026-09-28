import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { applyRateQuoteAddressToOrderShippingJson } from "./order-shipping-json.ts"

const shipTo = {
  name: "Avery Buyer",
  phone: "8055550100",
  company_name: "",
  address_line1: "200 State St",
  address_line2: "Apt 4",
  city_locality: "Santa Barbara",
  state_province: "CA",
  postal_code: "93101",
  country_code: "US",
  residential: "yes" as const,
}

describe("applyRateQuoteAddressToOrderShippingJson", () => {
  it("replaces the destination and keeps the buyer email", () => {
    const next = applyRateQuoteAddressToOrderShippingJson(
      {
        name: "Old Name",
        phone: "111",
        email: "buyer@example.com",
        admin_terminal: true,
        address: {
          line1: "1 Old Rd",
          city: "Ventura",
          state: "CA",
          postal_code: "93001",
          country: "US",
          residential: "no",
        },
      },
      shipTo,
    )

    assert.equal(next.email, "buyer@example.com")
    assert.equal(next.admin_terminal, true)
    assert.equal(next.name, "Avery Buyer")
    assert.equal(next.phone, "8055550100")
    assert.equal(next.company_name, null)
    assert.deepEqual(next.address, {
      line1: "200 State St",
      line2: "Apt 4",
      city: "Santa Barbara",
      state: "CA",
      postal_code: "93101",
      country: "US",
      residential: "yes",
    })
  })

  it("stores a company name and clears a blank phone", () => {
    const next = applyRateQuoteAddressToOrderShippingJson(null, {
      ...shipTo,
      company_name: "Reswell",
      phone: "  ",
    })
    assert.equal(next.company_name, "Reswell")
    assert.equal(next.phone, null)
    assert.equal(next.name, "Avery Buyer")
    const address = next.address as { line1: string; city: string; postal_code: string }
    assert.equal(address.line1, "200 State St")
    assert.equal(address.city, "Santa Barbara")
    assert.equal(address.postal_code, "93101")
  })
})
