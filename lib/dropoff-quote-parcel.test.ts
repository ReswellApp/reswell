import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  overlayDropoffBoxesForQuote,
  suggestedDropoffParcelFromListing,
} from "@/lib/dropoff-quote-parcel"

const SANTA_BARBARA_RULES = [
  {
    id: "under-6-0",
    label: "6'0 and under",
    minLengthIn: null,
    maxLengthIn: 72,
    maxWidthIn: 22,
    boxLengthIn: 76,
    boxWidthIn: 22,
    boxHeightIn: 5,
    weightLb: 14,
  },
  {
    id: "6-1-to-6-6",
    label: "6'1–6'6",
    minLengthIn: 72.01,
    maxLengthIn: 78,
    maxWidthIn: null,
    boxLengthIn: 84,
    boxWidthIn: 22,
    boxHeightIn: 5,
    weightLb: 18,
  },
]

function listing(length: string) {
  return {
    id: "listing-1",
    dropoff_location_id: "sb",
    dimensions: JSON.stringify({ v: 2, L: length, W: "21", T: "2 1/2" }),
    shipping_package_tier: "shortboard",
    shipping_package_band: "shortboard_medium",
    shipping_packed_length_in: 78,
    shipping_packed_width_in: 20,
    shipping_packed_height_in: 4,
    shipping_packed_weight_oz: 160,
    dropoff_locations: {
      id: "sb",
      city: "Santa Barbara",
      state: "CA",
      postal_code: "93101",
      box_rules: SANTA_BARBARA_RULES,
    },
  }
}

describe("overlayDropoffBoxesForQuote", () => {
  it("quotes a 6'0 board in the Santa Barbara 76×22×5 box", () => {
    const result = overlayDropoffBoxesForQuote([listing("6'0")])
    assert.equal(result.ok, true)
    if (!result.ok) return
    const row = result.listings[0]
    assert.equal(row?.shipping_packed_length_in, 76)
    assert.equal(row?.shipping_packed_width_in, 22)
    assert.equal(row?.shipping_packed_height_in, 5)
    assert.equal(row?.shipping_packed_weight_oz, 224)
    assert.equal(row?.shipping_package_band, null)
  })

  it("quotes a 6'4 board in the 84×22×5 box", () => {
    const result = overlayDropoffBoxesForQuote([listing("6'4")])
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.listings[0]?.shipping_packed_length_in, 84)
    assert.equal(result.listings[0]?.shipping_packed_weight_oz, 288)
  })

  it("refuses a board that does not fit the location", () => {
    const result = overlayDropoffBoxesForQuote([listing("7'0")])
    assert.equal(result.ok, false)
  })

  it("suggests the Santa Barbara carton for the exact-box form", () => {
    const parcel = suggestedDropoffParcelFromListing(listing("6'0"))
    assert.deepEqual(parcel, {
      lengthIn: "76",
      widthIn: "22",
      heightIn: "5",
      weightLb: "14",
      weightOz: "0",
    })
  })

  it("returns no suggested carton when the board does not fit", () => {
    assert.equal(suggestedDropoffParcelFromListing(listing("7'0")), null)
  })

  it("leaves a seller-packed listing alone when no drop-off is chosen", () => {
    const row = { ...listing("6'0"), dropoff_location_id: null }
    const result = overlayDropoffBoxesForQuote([row])
    assert.equal(result.ok, true)
    if (!result.ok) return
    assert.equal(result.listings[0]?.shipping_packed_length_in, 78)
    assert.equal(result.listings[0]?.shipping_package_band, "shortboard_medium")
  })
})
