import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildMobileInfoPage, getMobileInfoPage } from "./mobileInfoPage.ts"

describe("mobile info pages", () => {
  it("builds safety tips from the website copy", () => {
    const page = buildMobileInfoPage("safety")
    assert.equal(page.title, "Safety Tips")
    const cards = page.sections.find((section) => section.kind === "cards")
    assert.equal(cards?.kind, "cards")
    if (cards?.kind !== "cards") return
    assert.ok(cards.cards.some((item) => item.title === "Pay through Reswell"))
  })

  it("builds purchase protection with a claim flow", () => {
    const page = buildMobileInfoPage("protection-policy")
    assert.equal(page.title, "Purchase Protection")
    assert.ok(page.sections.some((section) => section.kind === "steps" && section.title === "How to file a claim"))
    assert.equal(page.cta_href, "/account/support")
  })

  it("builds Santa Barbara drop-off without a street address", () => {
    const page = buildMobileInfoPage("dropoff-santa-barbara")
    const text = JSON.stringify(page)
    assert.match(page.title, /Santa Barbara/)
    assert.doesNotMatch(text, /\d{3,5}\s+\w+\s+(St|Street|Ave|Avenue|Rd|Road)/i)
    assert.equal(page.cta_label, "Start a listing")
  })

  it("404s unknown slugs", () => {
    const result = getMobileInfoPage("terms")
    assert.equal(result.ok, false)
    if (result.ok) return
    assert.equal(result.status, 404)
  })
})
