import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { brandPageHref, brandPageResultsLabel, parseBrandPageTab } from "./routes.ts"

describe("parseBrandPageTab", () => {
  it("defaults unknown values to listings and accepts feed", () => {
    assert.equal(parseBrandPageTab(undefined), "listings")
    assert.equal(parseBrandPageTab("listings"), "listings")
    assert.equal(parseBrandPageTab("feed"), "feed")
    assert.equal(parseBrandPageTab("Feed"), "feed")
    assert.equal(parseBrandPageTab("nope"), "listings")
  })
})

describe("brandPageHref", () => {
  it("omits the default listings query and keeps feed as a tab param", () => {
    assert.equal(brandPageHref("chris-christenson"), "/brands/chris-christenson")
    assert.equal(brandPageHref("chris-christenson", "listings"), "/brands/chris-christenson")
    assert.equal(brandPageHref("chris-christenson", "feed"), "/brands/chris-christenson?tab=feed")
  })
})

describe("brandPageResultsLabel", () => {
  it("labels listing counts like a marketplace result total", () => {
    assert.equal(brandPageResultsLabel(0, { tab: "listings" }), "0 results")
    assert.equal(brandPageResultsLabel(1, { tab: "listings" }), "1 result")
    assert.equal(brandPageResultsLabel(12, { tab: "listings" }), "12 results")
    assert.equal(brandPageResultsLabel(48, { tab: "listings", capped: true }), "48+ results")
  })

  it("labels the sold feed count", () => {
    assert.equal(brandPageResultsLabel(0, { tab: "feed" }), "0 sold")
    assert.equal(brandPageResultsLabel(1, { tab: "feed" }), "1 sold")
    assert.equal(brandPageResultsLabel(8, { tab: "feed" }), "8 sold")
    assert.equal(brandPageResultsLabel(48, { tab: "feed", capped: true }), "48+ sold")
  })
})
