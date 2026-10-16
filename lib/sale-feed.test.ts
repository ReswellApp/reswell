import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { listingCompareAtPriceForDisplay } from "./listing-compare-at-price.ts"
import { mapSaleListingRow, type SaleListingRow } from "./db/saleListings.ts"
import { parseSaleFeedPage, saleFeedHref } from "./sale-feed.ts"

function row(overrides: Partial<SaleListingRow> = {}): SaleListingRow {
  return {
    id: "listing-1",
    slug: "lost-round-nose",
    user_id: "seller-1",
    title: "Lost Round Nose",
    price: 450,
    compare_at_price: 525,
    is_good_deal: false,
    condition: "used",
    section: "surfboards",
    local_pickup: true,
    shipping_available: true,
    board_type: "shortboard",
    primary_image_url: "https://cdn.example/cover.jpg",
    primary_thumbnail_url: null,
    ...overrides,
  }
}

describe("saleFeedHref", () => {
  it("keeps the first page canonical", () => {
    assert.equal(saleFeedHref(), "/sale")
    assert.equal(saleFeedHref(1), "/sale")
    assert.equal(saleFeedHref(0), "/sale")
  })

  it("pages the rest of the feed", () => {
    assert.equal(saleFeedHref(2), "/sale?page=2")
    assert.equal(saleFeedHref(2.8), "/sale?page=2")
  })
})

describe("parseSaleFeedPage", () => {
  it("falls back to page 1 for missing or invalid values", () => {
    assert.equal(parseSaleFeedPage(undefined), 1)
    assert.equal(parseSaleFeedPage("0"), 1)
    assert.equal(parseSaleFeedPage("nope"), 1)
    assert.equal(parseSaleFeedPage("3"), 3)
  })
})

describe("public markdown", () => {
  it("counts a compare-at above the list price as a markdown or price drop", () => {
    assert.equal(listingCompareAtPriceForDisplay(450, 525), 525)
    assert.equal(listingCompareAtPriceForDisplay(525, 450), null)
    assert.equal(listingCompareAtPriceForDisplay(450, null), null)
  })
})

describe("sale listing query", () => {
  it("includes every active visible section that still has a markdown", () => {
    const src = readFileSync(new URL("./db/saleListings.ts", import.meta.url), "utf8")
    assert.match(src, /\.eq\("status", "active"\)/)
    assert.match(src, /\.eq\("hidden_from_site", false\)/)
    assert.match(src, /\.is\("archived_at", null\)/)
    assert.match(src, /\.not\("compare_at_price", "is", null\)/)
    assert.doesNotMatch(src, /\.eq\("section"/)
  })
})

describe("mapSaleListingRow", () => {
  it("keeps the markdown price on the tile", () => {
    const listing = mapSaleListingRow(row())
    assert.equal(listing.price, 450)
    assert.equal(listing.compare_at_price, 525)
    assert.equal(listing.status, "active")
    assert.equal(listing.section, "surfboards")
    assert.equal(listing.slug, "lost-round-nose")
    assert.equal(listing.listing_images?.[0]?.url, "https://cdn.example/cover.jpg")
  })

  it("keeps fins and other sections in the same feed", () => {
    const listing = mapSaleListingRow(
      row({ section: "fins", title: "Futures Blackstix", board_type: null }),
    )
    assert.equal(listing.section, "fins")
    assert.equal(listing.board_type, null)
  })
})
