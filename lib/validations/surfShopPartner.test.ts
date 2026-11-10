import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { surfShopPartnerApplicationSchema } from "./surfShopPartner.ts"

describe("surfShopPartnerApplicationSchema", () => {
  it("accepts a complete shop application", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      shopName: "Tide Shop",
      city: "Santa Barbara, CA",
      website: "instagram.com/tideshop",
      boardCount: "10",
      message: "We have trade-ins ready.",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.shopName, "Tide Shop")
  })

  it("requires shop name and city", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      shopName: "",
      city: "",
    })
    assert.equal(parsed.success, false)
  })

  it("clears empty optional fields", () => {
    const parsed = surfShopPartnerApplicationSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      shopName: "Tide Shop",
      city: "Ventura",
      website: "  ",
      boardCount: "",
      message: "   ",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.website, undefined)
    assert.equal(parsed.data.boardCount, undefined)
    assert.equal(parsed.data.message, undefined)
  })
})
