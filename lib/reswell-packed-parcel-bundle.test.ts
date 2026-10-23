import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveCombinedPackedParcelFromListings } from "./reswell-packed-parcel-from-listing.ts"

function leash(id: string, weightOz: number) {
  return {
    id,
    section: "leashes",
    shipping_packed_length_in: 12,
    shipping_packed_width_in: 8,
    shipping_packed_height_in: 2,
    shipping_packed_weight_oz: weightOz,
  }
}

describe("small-parcel checkout bundles", () => {
  it("multiplies weight and grows the mailer when quantity is more than one", () => {
    const result = resolveCombinedPackedParcelFromListings([leash("a", 6)], { a: 3 })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.weightOz, 18)
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.equal(result.heightIn, 6)
  })

  it("combines different small parcels into one box", () => {
    const fin = {
      id: "fin",
      section: "fins",
      shipping_packed_length_in: 10,
      shipping_packed_width_in: 7,
      shipping_packed_height_in: 4,
      shipping_packed_weight_oz: 16,
    }
    const result = resolveCombinedPackedParcelFromListings([leash("leash", 6), fin], {
      leash: 2,
      fin: 1,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.weightOz, 28)
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.ok(result.heightIn > 2)
  })
})
