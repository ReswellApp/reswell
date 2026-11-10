import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { surfShopPartnerApplicationSchema } from "./surfShopPartner.ts"

describe("surfShopPartnerApplicationSchema", () => {
  it("accepts shop name, email, and city", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      email: "alex@example.com",
      shopName: "Tide Shop",
      city: "Santa Barbara, CA",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.shopName, "Tide Shop")
  })

  it("requires shop name, email, and city", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      email: "alex@example.com",
      shopName: "",
      city: "",
    })
    assert.equal(parsed.success, false)
  })

  it("rejects invalid email", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      email: "not-an-email",
      shopName: "Tide Shop",
      city: "Ventura",
    })
    assert.equal(parsed.success, false)
  })
})
