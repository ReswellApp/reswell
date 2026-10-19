import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { sellerResourcesNavLinks } from "../seller-resources.ts"
import { getMobileBrowseRail } from "./mobileBrowseRail.ts"

describe("mobile browse rail", () => {
  it("uses the website category order and the Seller Resources dropdown", () => {
    const rail = getMobileBrowseRail()
    const labels = rail.items.map((item) => item.label)
    assert.deepEqual(labels.slice(0, 9), [
      "Surfboards",
      "Fins",
      "Traction",
      "Wetsuits",
      "Boardbags",
      "Surfpacks",
      "Leashes",
      "Apparel",
      "Magazines",
    ])
    const menu = rail.items.find((item) => item.kind === "menu")
    assert.equal(menu?.kind, "menu")
    if (menu?.kind !== "menu") return
    assert.equal(menu.label, "Seller Resources")
    assert.deepEqual(
      menu.items.map((item) => item.href),
      sellerResourcesNavLinks.map((link) => link.href),
    )
    assert.deepEqual(
      menu.items.map((item) => item.screen),
      ["for-surf-shops", "how-to-sell", "how-to-ship", "sales-map", "seller-resources"],
    )
    const pages = rail.items.filter((item) => item.kind === "page")
    assert.deepEqual(
      pages.map((item) => (item.kind === "page" ? item.label : "")),
      ["Sellers", "Sold"],
    )
    assert.equal(pages[0]?.kind === "page" ? pages[0].page : null, "sellers")
    assert.equal(pages[1]?.kind === "page" ? pages[1].page : null, "sold")
  })

  it("sends known catalog paths to native category screens", () => {
    const rail = getMobileBrowseRail()
    const surfboards = rail.items.find((item) => item.kind === "category" && item.label === "Surfboards")
    assert.equal(surfboards?.kind, "category")
    if (surfboards?.kind !== "category") return
    assert.equal(surfboards.category, "surfboards")
  })
})
