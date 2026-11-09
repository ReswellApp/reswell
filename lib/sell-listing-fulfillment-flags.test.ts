import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { reswellPackageFieldsToDb } from "./sell-listing-fulfillment-flags.ts"

describe("reswellPackageFieldsToDb", () => {
  it("never writes a surfboard carton onto fins", () => {
    const packed = reswellPackageFieldsToDb({
      boardShippingCostMode: "reswell",
      listingSection: "fins",
      adminCustomShippingCarton: true,
      surfboardShippingTier: "shortboard",
      surfboardShippingPackBand: "shortboard_medium",
      reswellPackageLengthIn: "10",
      reswellPackageWidthIn: "7",
      reswellPackageHeightIn: "4",
      reswellPackageWeightLb: "3",
      reswellPackageWeightOz: "0",
    })
    assert.equal(packed.shipping_package_tier, null)
    assert.equal(packed.shipping_package_band, null)
    assert.equal(packed.shipping_packed_length_in, 10)
    assert.equal(packed.shipping_packed_width_in, 7)
    assert.equal(packed.shipping_packed_height_in, 4)
    assert.equal(packed.shipping_packed_weight_oz, 48)
  })

  it("keeps a shortboard pack band on surfboard listings", () => {
    const packed = reswellPackageFieldsToDb({
      boardShippingCostMode: "reswell",
      listingSection: "surfboards",
      surfboardShippingTier: "shortboard",
      surfboardShippingPackBand: "shortboard_medium",
    })
    assert.equal(packed.shipping_package_tier, "shortboard")
    assert.equal(packed.shipping_package_band, "shortboard_medium")
    assert.ok((packed.shipping_packed_length_in ?? 0) >= 70)
  })

  it("assigns the leash carton, not a leftover shortboard, when dims are blank", () => {
    const packed = reswellPackageFieldsToDb({
      boardShippingCostMode: "reswell",
      listingSection: "leashes",
      surfboardShippingTier: "shortboard",
      surfboardShippingPackBand: "shortboard_medium",
    })
    assert.equal(packed.shipping_package_tier, null)
    assert.equal(packed.shipping_package_band, null)
    assert.equal(packed.shipping_packed_length_in, 12)
    assert.equal(packed.shipping_packed_width_in, 10)
    assert.equal(packed.shipping_packed_height_in, 4)
    assert.equal(packed.shipping_packed_weight_oz, 32)
  })

  it("does not write a surfboard carton when the listing section is missing", () => {
    const packed = reswellPackageFieldsToDb({
      boardShippingCostMode: "reswell",
      surfboardShippingTier: "shortboard",
      surfboardShippingPackBand: "shortboard_medium",
    })
    assert.equal(packed.shipping_package_tier, null)
    assert.equal(packed.shipping_package_band, null)
  })
})
