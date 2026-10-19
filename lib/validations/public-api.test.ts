import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { publicApiSearchQuerySchema } from "./public-api.ts"

describe("public API search query", () => {
  it("accepts brand, model, and city without a free-text query", () => {
    const parsed = publicApiSearchQuerySchema.safeParse({
      type: "listings",
      brand: "channel-islands",
      model: "twin pin",
      city: "San Diego",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success) return
    assert.equal(parsed.data.q, undefined)
    assert.equal(parsed.data.city, "San Diego")
  })

  it("rejects a search with no query and no filters", () => {
    const parsed = publicApiSearchQuerySchema.safeParse({ q: "  " })
    assert.equal(parsed.success, false)
  })
})
