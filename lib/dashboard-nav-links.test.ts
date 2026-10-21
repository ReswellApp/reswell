import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { dashboardNavSections } from "./dashboard-nav-links.ts"

describe("dashboardNavSections", () => {
  it("groups links into Selling, Buying, and Account", () => {
    const sections = dashboardNavSections({
      isAdmin: false,
      isShipper: false,
      isDropoffLocation: false,
      hasShopifyAccess: false,
      showEarnings: true,
    })

    assert.deepEqual(
      sections.map((s) => s.id),
      ["selling", "buying", "account"],
    )
    assert.deepEqual(
      sections.map((s) => s.label),
      ["Selling", "Buying", "Account"],
    )
    assert.deepEqual(
      sections.find((s) => s.id === "selling")?.links.map((l) => l.name),
      ["Listings", "Offers", "Sales", "Earnings"],
    )
    assert.deepEqual(
      sections.find((s) => s.id === "buying")?.links.map((l) => l.name),
      ["Purchases", "Offers", "Favorites", "Following"],
    )
    assert.deepEqual(
      sections.find((s) => s.id === "account")?.links.map((l) => l.name),
      ["Overview", "Profile", "Messages", "Support"],
    )
  })

  it("puts role and shop tools under Selling", () => {
    const sections = dashboardNavSections({
      isAdmin: true,
      isShipper: true,
      isDropoffLocation: true,
      hasShopifyAccess: true,
      showEarnings: true,
    })
    const selling = sections.find((s) => s.id === "selling")?.links.map((l) => l.name) ?? []
    assert.deepEqual(selling, [
      "Listings",
      "Offers",
      "Sales",
      "Earnings",
      "Shopify",
      "Balance Sheet",
      "Shipper",
      "Drop-off",
    ])
  })

  it("routes Buying Offers to the buyer tab", () => {
    const buyingOffers = dashboardNavSections({
      isAdmin: false,
      isShipper: false,
    })
      .find((s) => s.id === "buying")
      ?.links.find((l) => l.id === "offers-buying")

    assert.equal(buyingOffers?.href, "/dashboard/offers?tab=buyer")
  })
})
