import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { VIEWED_LISTING_METRIC } from "./marketplace-metrics.ts"
import {
  klaviyoPageViewMetricForPathname,
  listingIdentifierFromPathname,
} from "./page-view-path.ts"

describe("listingIdentifierFromPathname", () => {
  it("reads a listing slug or id", () => {
    assert.equal(listingIdentifierFromPathname("/l/album-twin"), "album-twin")
    assert.equal(
      listingIdentifierFromPathname("/l/11111111-1111-4111-8111-111111111111"),
      "11111111-1111-4111-8111-111111111111",
    )
    assert.equal(listingIdentifierFromPathname("/l/short%20board"), "short board")
  })

  it("ignores other paths", () => {
    assert.equal(listingIdentifierFromPathname("/boards"), null)
    assert.equal(listingIdentifierFromPathname("/l/album-twin/edit"), null)
    assert.equal(listingIdentifierFromPathname("/sell"), null)
    assert.equal(listingIdentifierFromPathname("/l/"), null)
  })
})

describe("klaviyoPageViewMetricForPathname", () => {
  it("sends listing pages to Viewed Listing", () => {
    assert.deepEqual(klaviyoPageViewMetricForPathname("/l/album-twin"), {
      metricName: VIEWED_LISTING_METRIC,
      segment: "listing",
    })
  })

  it("keeps catalog, sell, and the rest of the site on their own metrics", () => {
    assert.equal(klaviyoPageViewMetricForPathname("/boards").metricName, "Viewed Boards Page")
    assert.equal(klaviyoPageViewMetricForPathname("/boards/shortboard").metricName, "Viewed Boards Page")
    assert.equal(klaviyoPageViewMetricForPathname("/sell/new").metricName, "Viewed Sell Page")
    assert.equal(klaviyoPageViewMetricForPathname("/cart").metricName, "Viewed Site Page")
  })
})
