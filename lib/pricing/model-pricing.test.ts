import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildModelPricingSitemapEntries } from "../sitemap/model-page-entries.ts"
import {
  buildModelPricingView,
  emptyMarketStats,
  formatPricingCount,
  formatPricingRange,
  formatPricingSaleDate,
  formatPricingUsd,
  isModelPricingPageIndexable,
  modelPricingHref,
  type ModelPricingInput,
} from "./model-pricing.ts"

describe("modelPricingHref", () => {
  it("builds the model pricing path", () => {
    assert.equal(
      modelPricingHref("christenson-surfboards", "lane-splitter"),
      "/pricing/brand/christenson-surfboards/lane-splitter",
    )
  })
})

describe("pricing formats", () => {
  it("keeps cents and compresses large samples", () => {
    assert.equal(formatPricingUsd(12.59), "$12.59")
    assert.equal(formatPricingUsd(10), "$10.00")
    assert.equal(formatPricingUsd(null), "—")
    assert.equal(formatPricingRange(2, 65), "$2.00 – $65.00")
    assert.equal(formatPricingRange(12, 12), "$12.00")
    assert.equal(formatPricingCount(9), "9")
    assert.equal(formatPricingCount(1000), "1000+")
    assert.equal(formatPricingCount(2400), "1000+")
  })

  it("formats sale dates as a calendar day", () => {
    assert.equal(formatPricingSaleDate("2026-10-24"), "Oct 24, 2026")
    assert.equal(formatPricingSaleDate("2026-10-25T05:00:00.000Z"), "Oct 24, 2026")
    assert.equal(formatPricingSaleDate(""), "—")
  })
})

describe("buildModelPricingView", () => {
  it("uses sold range, average, median, and recent sales", () => {
    const view = buildModelPricingView(samplePage())
    assert.equal(view.title, "Lane Splitter")
    assert.equal(view.brandName, "Christenson")
    assert.equal(view.specLine, `5'10" × 19 1/2" × 2 1/2"`)
    assert.equal(view.categoryLabel, "Surfboards / Shortboard")
    assert.equal(view.categoryHref, "/boards")
    assert.equal(view.salesCountLabel, "1000+")
    assert.equal(view.salesNoun, "sales")
    assert.equal(view.liveListingsLabel, "2 live listings")
    assert.equal(view.rangeLabel, "$2.00 – $65.00")
    assert.equal(view.avgLabel, "$12.59")
    assert.equal(view.medianLabel, "$12.00")
    assert.equal(view.buy?.label, "Buy the board")
    assert.equal(view.buy?.href, "/l/cheap-board")
    assert.equal(view.listingsHref, "/christenson-surfboards/lane-splitter#listings")
    assert.equal(view.allModelsHref, "/brands/christenson-surfboards")
    assert.equal(view.sellHref, "/sell/boards")
    assert.deepEqual(
      view.crumbs.map((crumb) => crumb.label),
      ["Home", "Pricing", "Christenson", "Lane Splitter"],
    )
    assert.equal(view.sales.length, 1)
    assert.equal(view.sales[0]?.priceLabel, "$10.00")
    assert.equal(view.sales[0]?.conditionLabel, "Like New")
    assert.equal(view.sales[0]?.dateLabel, "Oct 24, 2026")
    assert.equal(view.sales[0]?.href, "/l/sold-board")
  })

  it("hides the buy button when nothing is listed", () => {
    const page = samplePage()
    page.listings = []
    page.priceGuide = page.priceGuide
      ? { ...page.priceGuide, asking: { ...emptyMarketStats() } }
      : null
    const view = buildModelPricingView(page)
    assert.equal(view.buy, null)
    assert.equal(view.liveListingsLabel, "0 live listings")
  })
})

describe("isModelPricingPageIndexable", () => {
  it("skips an empty catalog shell", () => {
    assert.equal(
      isModelPricingPageIndexable({
        listingCount: 0,
        soldListingCount: 0,
        guideSoldCount: 0,
        guideAskingCount: 0,
        hasPriceGuide: false,
      }),
      false,
    )
    assert.equal(
      isModelPricingPageIndexable({
        listingCount: 0,
        soldListingCount: 1,
        guideSoldCount: 0,
        guideAskingCount: 0,
        hasPriceGuide: false,
      }),
      true,
    )
  })
})

describe("pricing sitemap", () => {
  it("emits a pricing URL for each catalog model", () => {
    const entries = buildModelPricingSitemapEntries(
      [{ brandSlug: "christenson-surfboards", modelSlug: "lane-splitter" }],
      "https://www.reswell.app",
      new Date("2026-10-24T00:00:00.000Z"),
    )
    assert.equal(
      entries[0]?.url,
      "https://www.reswell.app/pricing/brand/christenson-surfboards/lane-splitter",
    )
  })
})

function samplePage(): ModelPricingInput {
  return {
    brand: {
      name: "Christenson",
      slug: "christenson-surfboards",
      logo_url: null,
      location_label: "Santa Barbara, CA",
    },
    model: {
      name: "Lane Splitter",
      image_url: null,
      product_category_slug: "surfboards",
      board_category_slug: "shortboard",
    },
    modelSlug: "lane-splitter",
    variants: [
      { length_label: `5'10"`, width_label: `19 1/2"`, thickness_label: `2 1/2"` },
    ],
    listings: [
      { id: "live-1", slug: "dear-board", price: 40, section: "surfboards" },
      { id: "live-2", slug: "cheap-board", price: 18, section: "surfboards" },
    ],
    soldListings: [
      {
        id: "sold-1",
        slug: "sold-board",
        price: 10,
        section: "surfboards",
        condition: "like_new",
        updated_at: "2026-10-24",
      },
    ],
    topPick: null,
    listingImageUrl: null,
    priceGuide: {
      category_slug: "surfboards",
      category_label: "Surfboards",
      brand: { id: "b1", name: "Christenson", slug: "christenson-surfboards", logo_url: null },
      model: { id: "m1", name: "Lane Splitter", slug: "lane-splitter" },
      typical: {
        low_usd: 8,
        mid_usd: 12,
        high_usd: 20,
        new_retail_usd: null,
        source: "market",
      },
      asking: { ...emptyMarketStats(), count: 2, min_usd: 18, max_usd: 40, avg_usd: 29, median_usd: 29 },
      sold: {
        ...emptyMarketStats(),
        count: 1200,
        min_usd: 2,
        max_usd: 65,
        avg_usd: 12.59,
        median_usd: 12,
      },
      confidence: "solid",
      condition_bands: [],
      entry: null,
      recent_sold: [],
      live_listings: [],
      browse_href: "/boards",
      sell_href: "/sell/boards",
    },
  }
}
