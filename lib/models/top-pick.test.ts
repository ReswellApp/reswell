import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickTopModelListing } from "./top-pick.ts"

describe("pickTopModelListing", () => {
  it("prefers a newer brand-new listing over a fair used one", () => {
    const top = pickTopModelListing([
      {
        id: "used",
        condition: "fair",
        created_at: "2026-09-01T00:00:00.000Z",
        photo_count: 1,
      },
      {
        id: "new",
        condition: "brand_new",
        shipping_available: true,
        shop_verified: true,
        created_at: "2026-09-17T00:00:00.000Z",
        photo_count: 4,
      },
    ])
    assert.equal(top?.id, "new")
  })

  it("returns null when there are no listings", () => {
    assert.equal(pickTopModelListing([]), null)
  })
})
