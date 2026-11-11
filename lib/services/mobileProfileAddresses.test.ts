import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileProfileAddressBodySchema, mobileProfileAddressPatchSchema } from "@reswell/api-contract"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { toMobileProfileAddress } from "./mobileProfileAddresses.ts"

function row(partial: Partial<ProfileAddressRow> = {}): ProfileAddressRow {
  return {
    id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
    profile_id: "11111111-1111-4111-8111-111111111111",
    full_name: "Hayden Garfield",
    phone: "8055551212",
    line1: "915 DE LA VINA ST",
    line2: null,
    city: "SANTA BARBARA",
    state: "CA",
    postal_code: "93101-3220",
    country: "US",
    label: "Home",
    is_default: true,
    created_at: "2026-09-17T00:00:00.000Z",
    updated_at: "2026-09-17T00:00:00.000Z",
    ...partial,
  }
}

describe("mobile profile addresses", () => {
  it("maps a saved address for edit", () => {
    const mapped = toMobileProfileAddress(row())
    assert.ok(mapped)
    assert.equal(mapped.label, "Home")
    assert.equal(mapped.is_default, true)
    assert.equal(mapped.line1, "915 DE LA VINA ST")
    assert.equal(mapped.city, "SANTA BARBARA")
    assert.equal(mapped.line, "915 DE LA VINA ST · SANTA BARBARA, CA, 93101-3220")
  })

  it("drops incomplete saved addresses instead of sending empty streets", () => {
    assert.equal(toMobileProfileAddress(row({ line1: "" })), null)
    assert.equal(toMobileProfileAddress(row({ city: "  " })), null)
    assert.equal(toMobileProfileAddress(row({ postal_code: "" })), null)
  })

  it("defaults country to US when creating", () => {
    const parsed = mobileProfileAddressBodySchema.parse({
      line1: "816 Alberta Avenue",
      city: "Santa Barbara",
      postal_code: "93101",
    })
    assert.equal(parsed.country, "US")
  })

  it("allows setting default without rewriting the street", () => {
    const parsed = mobileProfileAddressPatchSchema.parse({ is_default: true })
    assert.deepEqual(parsed, { is_default: true })
  })
})
