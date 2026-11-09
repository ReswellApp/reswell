import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM,
} from "./fin-reswell-shipping-defaults.ts"
import { resolvePackedParcelFromListing } from "./reswell-packed-parcel-from-listing.ts"

describe("resolvePackedParcelFromListing", () => {
  it("quotes the stored surfboard box instead of a stock pack band", () => {
    const result = resolvePackedParcelFromListing({
      section: "surfboards",
      shipping_package_tier: "shortboard",
      shipping_package_band: "shortboard_medium",
      shipping_packed_length_in: 74,
      shipping_packed_width_in: 22,
      shipping_packed_height_in: 5,
      shipping_packed_weight_oz: 224,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 74)
    assert.equal(result.widthIn, 22)
    assert.equal(result.heightIn, 5)
    assert.equal(result.weightOz, 224)
  })

  it("does not rate fins on a leftover shortboard carton", () => {
    const result = resolvePackedParcelFromListing({
      section: "fins",
      shipping_package_tier: "shortboard",
      shipping_package_band: "shortboard_medium",
      shipping_packed_length_in: 78,
      shipping_packed_width_in: 25.5,
      shipping_packed_height_in: 7.25,
      shipping_packed_weight_oz: 352,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM)
    assert.equal(result.widthIn, FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM)
    assert.equal(result.heightIn, FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM)
    assert.equal(result.weightOz, FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM)
  })

  it("does not treat leftover board dimensions on a fin as a surfboard box", () => {
    const result = resolvePackedParcelFromListing({
      section: "fins",
      dimensions: "(6'2 18 2 1/4 32L)",
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM)
    assert.equal(result.widthIn, FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM)
    assert.equal(result.heightIn, FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM)
    assert.equal(result.weightOz, FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM)
  })

  it("keeps a seller-entered fin box when the dims look like a small parcel", () => {
    const result = resolvePackedParcelFromListing({
      section: "fins",
      shipping_packed_length_in: 12,
      shipping_packed_width_in: 8,
      shipping_packed_height_in: 3,
      shipping_packed_weight_oz: 20,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.equal(result.heightIn, 3)
    assert.equal(result.weightOz, 20)
  })

  it("keeps a leash on its packed mailer even if a surfboard tier leaked onto the row", () => {
    const result = resolvePackedParcelFromListing({
      section: "leashes",
      shipping_package_tier: "shortboard",
      shipping_packed_length_in: 12,
      shipping_packed_width_in: 8,
      shipping_packed_height_in: 2,
      shipping_packed_weight_oz: 6,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 8)
    assert.equal(result.heightIn, 2)
    assert.equal(result.weightOz, 6)
  })

  it("does not rate a leftover shortboard carton as a leash box", () => {
    const result = resolvePackedParcelFromListing({
      section: "leashes",
      shipping_package_tier: "shortboard",
      shipping_package_band: "shortboard_medium",
      shipping_packed_length_in: 78,
      shipping_packed_width_in: 25.5,
      shipping_packed_height_in: 7.25,
      shipping_packed_weight_oz: 352,
    })
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.lengthIn, 12)
    assert.equal(result.widthIn, 10)
    assert.equal(result.heightIn, 4)
    assert.equal(result.weightOz, 32)
  })

  it("does not quote a leftover board carton when section is omitted", () => {
    const result = resolvePackedParcelFromListing({
      shipping_package_tier: "shortboard",
      shipping_package_band: "shortboard_medium",
      shipping_packed_length_in: 78,
      shipping_packed_width_in: 25.5,
      shipping_packed_height_in: 7.25,
      shipping_packed_weight_oz: 352,
      dimensions: "(6'2 18 2 1/4 32L)",
    })
    assert.equal(result.ok, false)
  })
})
