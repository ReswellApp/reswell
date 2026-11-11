import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { mobileProfileAddressSchema, mobileProfileSettingsSchema } from "./index.ts"

const legacyAddress = {
  id: "6d8b6c3e-1f4a-4c2d-9a7b-0e5f1a2b3c4d",
  label: "Home",
  full_name: "Hayden Garfield",
  line: "915 DE LA VINA ST · SANTA BARBARA, CA, 93101-3220",
  is_default: true,
}

describe("mobileProfileAddressSchema", () => {
  it("accepts the older display-only address payload", () => {
    const parsed = mobileProfileAddressSchema.parse(legacyAddress)
    assert.equal(parsed.line, legacyAddress.line)
    assert.equal(parsed.line1, "")
    assert.equal(parsed.line2, null)
    assert.equal(parsed.city, "")
    assert.equal(parsed.country, "US")
  })

  it("keeps street fields when the API sends them", () => {
    const parsed = mobileProfileAddressSchema.parse({
      ...legacyAddress,
      line1: "915 DE LA VINA ST",
      line2: null,
      city: "SANTA BARBARA",
      state: "CA",
      postal_code: "93101-3220",
      country: "US",
    })
    assert.equal(parsed.line1, "915 DE LA VINA ST")
    assert.equal(parsed.city, "SANTA BARBARA")
    assert.equal(parsed.postal_code, "93101-3220")
  })
})

describe("mobileProfileSettingsSchema", () => {
  it("loads profile settings when addresses omit street fields", () => {
    const parsed = mobileProfileSettingsSchema.parse({
      display_name: "Hayden",
      seller_slug: "hayden",
      email: "hayden@reswell.app",
      avatar_url: null,
      bio: null,
      location: null,
      city: null,
      shop_banner_url: null,
      shop_tile_banner_url: null,
      signed_in_with: "email",
      has_email_password: true,
      message_sms_opt_in: false,
      sms_phone: null,
      push_opt_in: true,
      push_messages: true,
      push_offers: true,
      push_saves: true,
      push_follows: true,
      push_orders: true,
      addresses: [legacyAddress],
    })
    assert.equal(parsed.addresses[0]?.line, legacyAddress.line)
    assert.equal(parsed.addresses[0]?.line1, "")
  })
})
