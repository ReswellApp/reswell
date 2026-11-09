import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingDraftSaveSchema } from "./listing-draft-save.ts"

describe("listingDraftSaveSchema", () => {
  it("accepts a surfboard draft whose price and date are not plain strings", () => {
    const parsed = listingDraftSaveSchema.safeParse({
      section: "surfboards",
      listingId: "",
      price: 450,
      sellerPurchasedOn: "2024-05-01T00:00:00.000Z",
      locationLat: null,
      locationLng: null,
      boardBrandId: "",
      boardBrandModelId: "not-a-uuid",
    })
    assert.equal(parsed.success, true)
    if (!parsed.success || parsed.data.section !== "surfboards") return
    assert.equal(parsed.data.listingId, null)
    assert.equal(parsed.data.price, "450")
    assert.equal(parsed.data.sellerPurchasedOn, "2024-05-01")
    assert.equal(parsed.data.locationLat, undefined)
    assert.equal(parsed.data.boardBrandId, null)
  })

  it("accepts a fin draft with an empty brand id and a formatted price", () => {
    const parsed = listingDraftSaveSchema.safeParse({
      section: "fins",
      brandId: "",
      brandModelId: null,
      price: "$1,200",
      sellerPurchasedOn: null,
    })
    assert.equal(parsed.success, true)
    if (!parsed.success || parsed.data.section !== "fins") return
    assert.equal(parsed.data.brandId, null)
    assert.equal(parsed.data.price, "$1,200")
    assert.equal(parsed.data.sellerPurchasedOn, "")
  })
})
