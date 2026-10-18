import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingToOpenAiCatalogFeedItem } from "./catalog-product.ts"

describe("listingToOpenAiCatalogFeedItem", () => {
  it("keeps the product click URL and the description on the listing path", () => {
    const item = listingToOpenAiCatalogFeedItem({
      id: "890bf751-0261-446c-85c3-05e0e9284f55",
      slug: "60-chris-christenson-lane-splitter",
      title: "6'0 Chris Christenson Lane Splitter",
      description: "Excellent condition.",
      price: 895,
      section: "surfboards",
      status: "active",
      brand: "Chris Christenson",
      listing_images: [{ url: "https://www.reswell.app/media/listings/board.jpg", sort_order: 0 }],
    })
    assert.ok(item)
    assert.match(item.url, /\/l\/60-chris-christenson-lane-splitter/)
    assert.match(item.url, /utm_source=chatgpt/)
    assert.match(item.description, /Exact listing page: https:\/\/[^ ]+\/l\/60-chris-christenson-lane-splitter/)
    assert.doesNotMatch(item.description, /utm_source=/)
  })
})
