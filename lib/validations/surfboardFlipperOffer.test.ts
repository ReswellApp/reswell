import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { surfboardFlipperOfferSchema } from "./surfboardFlipperOffer.ts"

describe("surfboardFlipperOfferSchema", () => {
  it("accepts name and email", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "Alex",
      email: "alex@example.com",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.name, "Alex")
  })

  it("requires name and email", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "",
      email: "alex@example.com",
    })
    assert.equal(parsed.success, false)
  })

  it("rejects invalid email", () => {
    const parsed = surfboardFlipperOfferSchema.safeParse({
      name: "Alex",
      email: "not-an-email",
    })
    assert.equal(parsed.success, false)
  })
})
