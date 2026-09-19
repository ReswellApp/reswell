import assert from "node:assert/strict"
import { describe, it } from "node:test"
import type { PriceGuideComp } from "@/lib/types/price-guide"
import {
  applyRecentSalePrices,
  listingIdFromPriceGuideComp,
  listingIdsFromPriceGuideRecentSold,
  orderListingsByRecentSales,
} from "./recent-sales-listings.ts"

function saleComp(listingId: string, soldAt: string, slug?: string): PriceGuideComp {
  return {
    id: `sale:${listingId}`,
    sold_price_usd: 600,
    sold_at: soldAt,
    condition: "excellent",
    condition_label: "Excellent",
    dimensions: "6'0",
    title: "Lane Splitter",
    source: "reswell",
    source_label: "Sold on Reswell",
    listing_url: `/l/${slug ?? listingId}`,
    include_in_public: true,
  }
}

function manualComp(): PriceGuideComp {
  return {
    id: "manual-1",
    sold_price_usd: 550,
    sold_at: "2026-07-01",
    condition: null,
    condition_label: null,
    dimensions: null,
    title: "Off-platform",
    source: "fb_marketplace",
    source_label: "Facebook Marketplace",
    listing_url: "https://facebook.com/marketplace/item/1",
    include_in_public: true,
  }
}

describe("listingIdFromPriceGuideComp", () => {
  it("reads the listing UUID from a Reswell sale row", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    assert.equal(listingIdFromPriceGuideComp(saleComp(id, "2026-09-18")), id)
  })

  it("skips manual comps without a listing UUID", () => {
    assert.equal(listingIdFromPriceGuideComp(manualComp()), null)
  })
})

describe("orderListingsByRecentSales", () => {
  it("keeps only Recent sales listings and uses that table order", () => {
    const older = "22222222-2222-4222-8222-222222222222"
    const newer = "11111111-1111-4111-8111-111111111111"
    const extra = "33333333-3333-4333-8333-333333333333"
    const ordered = orderListingsByRecentSales(
      [
        { id: extra, slug: "extra" },
        { id: older, slug: "older" },
        { id: newer, slug: "newer" },
      ],
      [saleComp(newer, "2026-09-18", "newer"), saleComp(older, "2026-08-03", "older"), manualComp()],
    )
    assert.deepEqual(
      ordered.map((row) => row.id),
      [newer, older],
    )
  })

  it("matches a sale row by listing slug when the id is not a UUID path", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const ordered = orderListingsByRecentSales(
      [{ id, slug: "60-chris-christenson-lane-splitter" }],
      [saleComp(id, "2026-09-18", "60-chris-christenson-lane-splitter")],
    )
    assert.equal(ordered[0]?.id, id)
  })
})

describe("applyRecentSalePrices", () => {
  it("uses the Recent sales sold price on the matching listing", () => {
    const id = "11111111-1111-4111-8111-111111111111"
    const [priced] = applyRecentSalePrices(
      [{ id, slug: "newer", price: 700, compare_at_price: null }],
      [{ ...saleComp(id, "2026-09-18", "newer"), sold_price_usd: 625 }],
    )
    assert.equal(priced?.price, 625)
    assert.equal(priced?.compare_at_price, 700)
  })
})

describe("listingIdsFromPriceGuideRecentSold", () => {
  it("returns unique Reswell sale listing ids", () => {
    const a = "11111111-1111-4111-8111-111111111111"
    const b = "22222222-2222-4222-8222-222222222222"
    assert.deepEqual(listingIdsFromPriceGuideRecentSold([saleComp(a, "2026-09-18"), saleComp(a, "2026-09-18"), saleComp(b, "2026-08-03"), manualComp()]), [
      a,
      b,
    ])
  })
})
