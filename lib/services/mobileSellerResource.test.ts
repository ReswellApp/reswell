import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FOR_SURF_SHOPS_HERO_DESCRIPTION } from "../for-surf-shops.ts"
import { HOW_TO_SELL_HERO } from "../seller-resource-copy.ts"
import { sellerResourcesComingSoon } from "../seller-resources.ts"
import { buildMobileSellerResource } from "./mobileSellerResource.ts"

describe("mobile seller resources", () => {
  it("builds For surf shops from the website copy", () => {
    const page = buildMobileSellerResource("for-surf-shops")
    assert.equal(page.title, "For surf shops")
    const intro = page.sections.find((section) => section.kind === "paragraphs")
    assert.equal(intro?.kind, "paragraphs")
    if (intro?.kind !== "paragraphs") return
    assert.equal(intro.paragraphs[0], FOR_SURF_SHOPS_HERO_DESCRIPTION)
    assert.ok(page.sections.some((section) => section.kind === "faqs"))
  })

  it("builds How to Sell without live shop data", () => {
    const page = buildMobileSellerResource("how-to-sell")
    assert.equal(page.description, HOW_TO_SELL_HERO.description)
    const steps = page.sections.find((section) => section.kind === "steps")
    assert.equal(steps?.kind, "steps")
    if (steps?.kind !== "steps") return
    assert.equal(steps.steps[0]?.title, "Open Sell")
    assert.equal(page.sections.some((section) => section.kind === "cards" && section.title === "Photo examples"), false)
  })

  it("links the hub cards to the other native screens", () => {
    const page = buildMobileSellerResource("seller-resources")
    const cards = page.sections.find((section) => section.kind === "cards" && section.title === null)
    assert.equal(cards?.kind, "cards")
    if (cards?.kind !== "cards") return
    assert.deepEqual(
      cards.cards.map((item) => item.screen),
      ["for-surf-shops", "how-to-sell", "how-to-ship", "sales-map"],
    )
    const soon = page.sections.find((section) => section.kind === "cards" && section.title === "Coming soon")
    assert.equal(soon?.kind, "cards")
    if (soon?.kind !== "cards") return
    assert.deepEqual(
      soon.cards.map((item) => item.title),
      sellerResourcesComingSoon.map((item) => item.label),
    )
  })

  it("turns sales-map totals into readable lines", () => {
    const page = buildMobileSellerResource("sales-map", {
      totals: {
        confirmedSales: 12,
        mappableSales: 10,
        statesSelling: 4,
        statesBuying: 6,
        crossStateSales: 8,
        volumeUsd: 2400,
      },
      flows: [
        { sellerState: "CA", buyerState: "HI", count: 3, volumeUsd: 900 },
      ],
    })
    const stats = page.sections.find((section) => section.kind === "paragraphs" && section.title === "Confirmed orders")
    assert.equal(stats?.kind, "paragraphs")
    if (stats?.kind !== "paragraphs") return
    assert.match(stats.paragraphs[0] ?? "", /12 confirmed sales/)
    const routes = page.sections.find((section) => section.kind === "cards")
    assert.equal(routes?.kind, "cards")
    if (routes?.kind !== "cards") return
    assert.match(routes.cards[0]?.title ?? "", /California/)
    assert.match(routes.cards[0]?.title ?? "", /Hawaii/)
  })
})
