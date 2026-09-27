import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  isListingProductPathname,
  klaviyoPageViewMetricForPathname,
  listingParamFromProductPathname,
} from "./page-view-metric.ts"

describe("isListingProductPathname", () => {
  it("matches listing product pages only", () => {
    assert.equal(isListingProductPathname("/l"), true)
    assert.equal(isListingProductPathname("/l/lost-round-nose"), true)
    assert.equal(isListingProductPathname(" /l/abc "), true)
  })

  it("does not treat browse or lookalike paths as product pages", () => {
    assert.equal(isListingProductPathname("/leashes"), false)
    assert.equal(isListingProductPathname("/listings"), false)
    assert.equal(isListingProductPathname("/listyoursurfboard"), false)
    assert.equal(isListingProductPathname("/boards"), false)
  })
})

describe("klaviyoPageViewMetricForPathname", () => {
  it("counts marketplace browsing as Viewed Site Page", () => {
    for (const pathname of [
      "/",
      "/boards",
      "/boards/",
      "/fins",
      "/wetsuits",
      "/search",
      "/brands/lost",
      "/cart",
    ]) {
      assert.deepEqual(klaviyoPageViewMetricForPathname(pathname), {
        metricName: "Viewed Site Page",
        segment: "site",
      })
    }
  })

  it("counts a listing page as Viewed Product", () => {
    assert.deepEqual(klaviyoPageViewMetricForPathname("/l/lost-round-nose"), {
      metricName: "Viewed Product",
      segment: "product",
    })
    assert.equal(
      listingParamFromProductPathname("/l/lost-round-nose"),
      "lost-round-nose",
    )
    assert.equal(
      listingParamFromProductPathname("/l/channel%20islands/"),
      "channel islands",
    )
  })

  it("does not treat a bare /l path as a product view", () => {
    assert.equal(klaviyoPageViewMetricForPathname("/l"), null)
    assert.equal(klaviyoPageViewMetricForPathname("/l/"), null)
    assert.equal(listingParamFromProductPathname("/l"), null)
    assert.equal(listingParamFromProductPathname("/boards"), null)
  })

  it("keeps the sell funnel on Viewed Sell Page", () => {
    assert.deepEqual(klaviyoPageViewMetricForPathname("/sell"), {
      metricName: "Viewed Sell Page",
      segment: "sell",
    })
    assert.deepEqual(klaviyoPageViewMetricForPathname("/sell/fins"), {
      metricName: "Viewed Sell Page",
      segment: "sell",
    })
  })
})
