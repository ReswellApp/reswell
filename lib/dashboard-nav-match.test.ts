import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  dashboardNavTabMatches,
  isMostSpecificDashboardNavMatch,
} from "./dashboard-nav-match.ts"

const HREFS = [
  "/dashboard",
  "/dashboard/profile",
  "/dashboard/profile/team",
  "/messages",
  "/dashboard/offers",
  "/dashboard/offers?tab=buyer",
]

describe("isMostSpecificDashboardNavMatch", () => {
  it("highlights Team on the profile team route and leaves Profile inactive", () => {
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard/profile/team", HREFS),
      true,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard/profile", HREFS),
      false,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile/team", "/dashboard", HREFS),
      false,
    )
  })

  it("highlights Profile only on the profile page", () => {
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard/profile", HREFS), true)
    assert.equal(
      isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard/profile/team", HREFS),
      false,
    )
  })

  it("keeps Overview exact and Messages prefix-aware", () => {
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard", "/dashboard", HREFS), true)
    assert.equal(isMostSpecificDashboardNavMatch("/dashboard/profile", "/dashboard", HREFS), false)
    assert.equal(isMostSpecificDashboardNavMatch("/messages/abc", "/messages", HREFS), true)
  })

  it("splits Selling vs Buying Offers by tab query", () => {
    const sellerParams = new URLSearchParams()
    assert.equal(
      isMostSpecificDashboardNavMatch(
        "/dashboard/offers",
        "/dashboard/offers",
        HREFS,
        sellerParams,
      ),
      true,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch(
        "/dashboard/offers",
        "/dashboard/offers?tab=buyer",
        HREFS,
        sellerParams,
      ),
      false,
    )

    const buyerParams = new URLSearchParams("tab=buyer")
    assert.equal(
      isMostSpecificDashboardNavMatch(
        "/dashboard/offers",
        "/dashboard/offers?tab=buyer",
        HREFS,
        buyerParams,
      ),
      true,
    )
    assert.equal(
      isMostSpecificDashboardNavMatch(
        "/dashboard/offers",
        "/dashboard/offers",
        HREFS,
        buyerParams,
      ),
      false,
    )
  })
})

describe("dashboardNavTabMatches", () => {
  it("treats received/seller as the Selling Offers entry", () => {
    assert.equal(
      dashboardNavTabMatches("/dashboard/offers", new URLSearchParams("tab=received")),
      true,
    )
    assert.equal(
      dashboardNavTabMatches("/dashboard/offers?tab=buyer", new URLSearchParams("tab=received")),
      false,
    )
  })
})
