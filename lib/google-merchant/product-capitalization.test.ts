import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildGoogleMerchantProductDescription } from "./product-description.ts"
import { mapListingToProductInput } from "./map-listing-to-product-input.ts"

describe("Google Merchant title/description capitalization", () => {
  it("sends title-cased titles instead of raw ALL CAPS", () => {
    const payload = mapListingToProductInput({
      id: "11111111-1111-1111-1111-111111111111",
      slug: "channel-islands-shortboard",
      title: "CHANNEL ISLANDS AL MERRICK SHORTBOARD",
      description: "GREAT BOARD WITH MINOR RAIL DINGS. LOCAL PICKUP ONLY.",
      price: 650,
      condition: "good",
      brand: "CHANNEL ISLANDS",
      model: "TWIN PIN",
      section: "surfboards",
      status: "active",
      board_type: "shortboard",
      listing_images: [
        {
          url: "https://cdn.example.com/board.jpg",
          is_primary: true,
          sort_order: 0,
        },
      ],
    })

    assert.ok(payload)
    assert.equal(payload.productAttributes.title, "Channel Islands Al Merrick Shortboard")
    assert.equal(payload.productAttributes.brand, "Channel Islands")
    assert.equal(payload.productAttributes.mpn, "Twin Pin")
    assert.match(
      payload.productAttributes.description,
      /Great Board With Minor Rail Dings\. Local Pickup Only\./,
    )
    assert.doesNotMatch(payload.productAttributes.description, /GREAT BOARD WITH MINOR/)
    assert.doesNotMatch(payload.productAttributes.title, /[A-Z]{5,}/)
  })

  it("normalizes all-caps seller notes inside the merchant description", () => {
    const description = buildGoogleMerchantProductDescription({
      title: "Lost Round Nose Fish",
      description: "THIS BOARD IS IN EXCELLENT SHAPE. NO DINGS.",
      price: 800,
      condition: "excellent",
      brand: "Lost",
      model: "Round Nose Fish",
      section: "surfboards",
      board_type: "fish",
      shipping_available: true,
      board_shipping_cost_mode: "free",
    })

    assert.match(description, /This Board Is In Excellent Shape\. No Dings\./)
    assert.doesNotMatch(description, /THIS BOARD IS IN EXCELLENT SHAPE/)
  })
})
