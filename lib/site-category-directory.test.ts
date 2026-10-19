import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  footerCategoryLinks,
  headerShopperNavItemIsActive,
  siteHeaderDesktopSecondaryNavLinks,
  siteHeaderShopperNavItems,
} from "./site-category-directory.ts"

describe("header shopper nav", () => {
  it("orders departments the way surfers shop", () => {
    assert.deepEqual(
      siteHeaderShopperNavItems.map((item) => item.label),
      ["Surfboards", "Fins", "Accessories", "Wetsuits", "Magazines"],
    )
  })

  it("puts shapes under surfboards and small gear under accessories", () => {
    const surfboards = siteHeaderShopperNavItems[0]
    const accessories = siteHeaderShopperNavItems.find((item) => item.label === "Accessories")
    assert.equal(surfboards?.menuOnly, undefined)
    assert.equal(
      surfboards?.menu?.some((link) => link.href === "/boards?type=fish"),
      true,
    )
    assert.equal(accessories?.menuOnly, true)
    assert.deepEqual(
      accessories?.menu?.map((link) => link.label),
      ["Boardbags", "Surfpacks", "Leashes", "Traction", "Apparel", "All accessories"],
    )
  })

  it("keeps seller tools and explore off the shopper rail", () => {
    const labels = siteHeaderShopperNavItems.map((item) => item.label)
    assert.equal(labels.includes("Seller Resources"), false)
    assert.equal(labels.includes("Traction"), false)
    assert.deepEqual(
      siteHeaderDesktopSecondaryNavLinks.map((item) => item.label),
      ["Sellers", "Sold"],
    )
  })

  it("marks surfboards active on a shape filter", () => {
    const surfboards = siteHeaderShopperNavItems[0]
    assert.ok(surfboards)
    const params = new URLSearchParams("type=fish")
    assert.equal(headerShopperNavItemIsActive("/boards", params, surfboards), true)
    assert.equal(headerShopperNavItemIsActive("/magazines", params, surfboards), false)
  })

  it("marks accessories active on grouped gear routes", () => {
    const accessories = siteHeaderShopperNavItems.find((item) => item.label === "Accessories")
    assert.ok(accessories)
    assert.equal(headerShopperNavItemIsActive("/leashes", new URLSearchParams(), accessories), true)
    assert.equal(headerShopperNavItemIsActive("/apparel", new URLSearchParams(), accessories), true)
    assert.equal(headerShopperNavItemIsActive("/fins", new URLSearchParams(), accessories), false)
  })

  it("lists accessory catalogs in the footer", () => {
    const hrefs = footerCategoryLinks.map((link) => link.href)
    assert.equal(hrefs.includes("/boardbags"), true)
    assert.equal(hrefs.includes("/apparel"), true)
    assert.equal(hrefs[0], "/boards")
    assert.equal(hrefs[1], "/fins")
  })
})
