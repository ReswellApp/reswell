import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  combineSmallParcelPackedWeightsOz,
  resolveCombinedPackedParcelFromListings,
  SMALL_PARCEL_SHARED_PACKAGING_OZ,
} from "./reswell-packed-parcel-from-listing.ts"

function leash(id: string, weightOz: number, dims?: { lengthIn: number; widthIn: number; heightIn: number }) {
  return {
    id,
    section: "leashes",
    shipping_packed_length_in: dims?.lengthIn ?? 12,
    shipping_packed_width_in: dims?.widthIn ?? 8,
    shipping_packed_height_in: dims?.heightIn ?? 2,
    shipping_packed_weight_oz: weightOz,
  }
}

describe("small-parcel checkout bundles", () => {
  it("keeps the same mailer size when quantity is more than one", () => {
    const result = resolveCombinedPackedParcelFromListings([leash("a", 6)], { a: 3 })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.weightOz, 18)
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.equal(result.heightIn, 2)
  })

  it("uses the largest solo carton when combining different small parcels", () => {
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
    // Light leash lines stay full weight; a single carton-heavy fin keeps its packaging.
    assert.equal(result.weightOz, 28)
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.equal(result.heightIn, 4)
  })

  it("keeps five shop-small leashes at one mailer size — never a tall stack", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      leash(id, 32, { lengthIn: 12, widthIn: 10, heightIn: 4 }),
    )
    const result = resolveCombinedPackedParcelFromListings(rows)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 10)
    assert.equal(result.heightIn, 4)
    assert.equal(result.weightOz, 32 + 4 * (32 - SMALL_PARCEL_SHARED_PACKAGING_OZ))
    const uspsDimLb = (result.lengthIn * result.widthIn * result.heightIn) / 166
    assert.ok(uspsDimLb < 4)
  })

  it("keeps five shop-medium leashes at the same 18×14×6 box", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      leash(id, 48, { lengthIn: 18, widthIn: 14, heightIn: 6 }),
    )
    const result = resolveCombinedPackedParcelFromListings(rows)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 18)
    assert.equal(result.widthIn, 14)
    assert.equal(result.heightIn, 6)
    const billableLb = Math.max(
      result.weightOz / 16,
      (result.lengthIn * result.widthIn * result.heightIn) / 166,
    )
    assert.ok(billableLb < 15)
  })
})

describe("combineSmallParcelPackedWeightsOz", () => {
  it("sums light product weights without packaging deductions", () => {
    assert.equal(combineSmallParcelPackedWeightsOz([6, 6, 6]), 18)
  })

  it("drops shared packaging from carton-heavy extras only", () => {
    assert.equal(
      combineSmallParcelPackedWeightsOz([32, 32, 32]),
      32 + 2 * (32 - SMALL_PARCEL_SHARED_PACKAGING_OZ),
    )
  })
})
