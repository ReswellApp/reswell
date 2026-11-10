import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { surfboardFlipperOfferSchema } from "./surfboardFlipperOffer.ts"

describe("surfboardFlipperOfferSchema", () => {
  it("accepts name, email, and city", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
      city: "Santa Barbara, CA",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.name, "Alex")
  })

  it("requires name, email, and city", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "",
      email: "alex@example.com",
      city: "",
    })
    assert.equal(parsed.success, false)
  })

  it("rejects invalid email", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "Alex",
      email: "not-an-email",
      city: "Ventura",
    })
    assert.equal(parsed.success, false)
  })
})
