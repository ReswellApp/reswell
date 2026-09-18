import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  parseOrderShippingAddressForProfile,
  profileAddressesMatch,
  profileAddressToOrderShippingJson,
  type ProfileAddressRow,
} from "./profile-address.ts"

function row(partial: Partial<ProfileAddressRow>): ProfileAddressRow {
  return {
    id: "addr-1",
    profile_id: "user-1",
    full_name: "Hayden Garfield",
    phone: "8055551212",
    line1: "123 Main St",
    line2: null,
    city: "Santa Barbara",
    state: "CA",
    postal_code: "93101",
    country: "US",
    label: null,
    is_default: true,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    residential: "no",
    address_validated_at: "2026-09-17T00:00:00.000Z",
    ...partial,
  }
}

describe("profileAddressToOrderShippingJson", () => {
  it("stores the carrier residential type on the order", () => {
    const json = profileAddressToOrderShippingJson(row({ residential: "no" }), "a@b.com")
    assert.equal(json.address.residential, "no")
    const parsed = parseOrderShippingAddressForProfile(json)
    assert.equal(parsed?.residential, "no")
    assert.equal(parsed?.postal_code, "93101")
  })

  it("defaults missing residential to yes for legacy orders", () => {
    const json = profileAddressToOrderShippingJson(row({ residential: null }), null)
    assert.equal(json.address.residential, "yes")
  })
})

describe("profileAddressesMatch", () => {
  it("treats ZIP and ZIP+4 as the same street", () => {
    assert.equal(
      profileAddressesMatch(row({ postal_code: "93101" }), {
        line1: "123 Main St",
        city: "Santa Barbara",
        postal_code: "93101-4321",
      }),
      true,
    )
  })
})
