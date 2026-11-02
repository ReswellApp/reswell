import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  combineSmallParcelPackedWeightsOz,
  resolveCombinedPackedParcelFromListings,
  SMALL_PARCEL_NEST_VOLUME_FACTOR,
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
  it("keeps light product weights additive by quantity", () => {
    const result = resolveCombinedPackedParcelFromListings([leash("a", 6)], { a: 3 })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.weightOz, 18)
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    // Nest extras into one mailer instead of stacking three 2″ cartons into a 6″ tower.
    assert.equal(result.heightIn, 3)
  })

  it("combines different small parcels into one nested box", () => {
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
    assert.ok(result.heightIn > 2)
    assert.ok(result.heightIn < 10)
  })

  it("does not stack five shop-small mailers into a DIM tower", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      leash(id, 32, { lengthIn: 12, widthIn: 10, heightIn: 4 }),
    )
    const result = resolveCombinedPackedParcelFromListings(rows)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 10)
    // Old solid-volume stack was 20″ tall / ~14 lb USPS DIM. Nested mailer stays near one box.
    assert.equal(result.heightIn, 8)
    assert.equal(result.weightOz, 32 + 4 * (32 - SMALL_PARCEL_SHARED_PACKAGING_OZ))
    const uspsDimLb = (result.lengthIn * result.widthIn * result.heightIn) / 166
    assert.ok(uspsDimLb < 8)
  })

  it("nests medium shop cartons so five leashes stay under a 20 lb billable DIM", () => {
    const rows = ["a", "b", "c", "d", "e"].map((id) =>
      leash(id, 48, { lengthIn: 18, widthIn: 14, heightIn: 6 }),
    )
    const result = resolveCombinedPackedParcelFromListings(rows)
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 18)
    assert.equal(result.widthIn, 14)
    assert.equal(result.heightIn, 12)
    const billableLb = Math.max(
      result.weightOz / 16,
      (result.lengthIn * result.widthIn * result.heightIn) / 166,
    )
    assert.ok(billableLb < 20)
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

  it("uses the nest factor constant expected by packing", () => {
    assert.equal(SMALL_PARCEL_NEST_VOLUME_FACTOR, 0.25)
  })
})
