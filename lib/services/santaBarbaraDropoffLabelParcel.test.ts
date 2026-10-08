import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { parseDropoffBoxRules, type DropoffBoxRule } from "@/lib/dropoff-location-box-rules"
import { SANTA_BARBARA_DROPOFF_LOCATION_ID } from "@/lib/dropoff-santa-barbara"
import type { PeerListingForShippingQuote } from "@/lib/services/peerListingShippingQuote"
import {
  applyDropoffBoxToListing,
  exactParcelFieldsFromDropoffRules,
  isSantaBarbaraDropoffListing,
} from "@/lib/services/santaBarbaraDropoffLabelParcel"

const RULES: DropoffBoxRule[] = parseDropoffBoxRules([
  {
    id: "under-6-0",
    label: "6'0 and under, 22\" wide or less",
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
])

function listing(dimensions: string): PeerListingForShippingQuote {
  return {
    dimensions,
    shipping_package_tier: "shortboard",
    shipping_package_band: "shortboard_medium",
    shipping_packed_length_in: 78,
    shipping_packed_width_in: 22,
    shipping_packed_height_in: 5,
    shipping_packed_weight_oz: 22 * 16,
    dropoff_location_id: SANTA_BARBARA_DROPOFF_LOCATION_ID,
  }
}

describe("exactParcelFieldsFromDropoffRules", () => {
  it("uses the Santa Barbara carton for a board 6'0 and under", () => {
    const parcel = exactParcelFieldsFromDropoffRules(RULES, {
      dimensions: '{"v":2,"L":"6\'0","W":"21","T":"2 1/2"}',
    })
    assert.ok(parcel)
    assert.equal(parcel.lengthIn, "76")
    assert.equal(parcel.widthIn, "22")
    assert.equal(parcel.heightIn, "5")
    assert.equal(parcel.weightLb, "14")
    assert.equal(parcel.weightOz, "0")
    assert.match(parcel.ruleLabel, /6'0 and under/)
  })

  it("uses the longer Santa Barbara carton from 6'1 to 6'6", () => {
    const parcel = exactParcelFieldsFromDropoffRules(RULES, {
      dimensions: '{"v":2,"L":"6\'4","W":"20","T":"2 3/4"}',
    })
    assert.ok(parcel)
    assert.equal(parcel.lengthIn, "84")
    assert.equal(parcel.weightLb, "18")
  })

  it("does not invent a box when the board is outside the location rules", () => {
    const parcel = exactParcelFieldsFromDropoffRules(RULES, {
      dimensions: '{"v":2,"L":"7\'0","W":"21","T":"2 1/2"}',
    })
    assert.equal(parcel, null)
  })
})

describe("applyDropoffBoxToListing", () => {
  it("replaces a pack band with the dropoff carton", () => {
    const dims = '{"v":2,"L":"6\'2","W":"19 1/2","T":"2 1/2"}'
    const fields = exactParcelFieldsFromDropoffRules(RULES, { dimensions: dims })
    assert.ok(fields)
    const rated = applyDropoffBoxToListing(listing(dims), fields)
    assert.equal(rated.shipping_package_band, null)
    assert.equal(rated.shipping_packed_length_in, 84)
    assert.equal(rated.shipping_packed_width_in, 22)
    assert.equal(rated.shipping_packed_height_in, 5)
    assert.equal(rated.shipping_packed_weight_oz, 18 * 16)
  })
})

describe("isSantaBarbaraDropoffListing", () => {
  it("matches the location slug when the stored id is not the seed id", () => {
    assert.equal(
      isSantaBarbaraDropoffListing(
        { dropoff_location_id: "11111111-1111-1111-1111-111111111111" },
        { slug: "santa-barbara" },
      ),
      true,
    )
  })
})
