import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { googleMerchantListingProductSchema } from "./listing-product-schema.ts"

describe("listing product JSON-LD", () => {
  it("publishes the gallery with the primary photo first", () => {
    const schema = googleMerchantListingProductSchema({
      id: "listing-1",
      slug: "ci-twin",
      title: "channel islands twin pin",
      description: "Used twin pin.",
      price: 650,
      brand: "Channel Islands",
      condition: "good",
      status: "active",
      section: "surfboards",
      board_type: "fish",
      dimensions: "5'10",
      fins_setup: null,
      fin_system: null,
      fin_size: null,
      wetsuit_size: null,
      apparel_kind: null,
      apparel_size: null,
      magazine_year: null,
      city: "San Diego",
      state: "CA",
      local_pickup: true,
      shipping_available: true,
      shipping_price: null,
      board_shipping_cost_mode: null,
      listing_images: [
        { url: "https://cdn.example/tail.jpg", is_primary: false, sort_order: 1 },
        { url: "https://cdn.example/deck.jpg", is_primary: true, sort_order: 0 },
      ],
    })
    assert.ok(schema)
    assert.deepEqual(schema.image, [
      "https://cdn.example/deck.jpg",
      "https://cdn.example/tail.jpg",
    ])
  })
})
