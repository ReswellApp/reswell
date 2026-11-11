import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { headerNavSearchSubmitHref } from "./header-nav-marketplace-search.ts"
import { hrefForNavMarketplaceSearch } from "./nav-marketplace-model-search.ts"

describe("headerNavSearchSubmitHref", () => {
  it("returns an empty string for blank input", () => {
    assert.equal(headerNavSearchSubmitHref(""), "")
    assert.equal(headerNavSearchSubmitHref("   "), "")
  })

  it("sends keyword searches to /search immediately", () => {
    assert.equal(
      headerNavSearchSubmitHref("lost mayhem"),
      "/search?q=lost+mayhem&nq=1",
    )
    assert.equal(
      hrefForNavMarketplaceSearch("lost mayhem"),
      "/search?q=lost+mayhem&nq=1",
    )
  })

  it("opens section browse hubs for bare section keywords", () => {
    assert.equal(headerNavSearchSubmitHref("fins"), "/fins")
    assert.equal(headerNavSearchSubmitHref("wetsuits"), "/wetsuits")
  })

  it("opens the boards hub for a bare board style", () => {
    assert.equal(
      headerNavSearchSubmitHref("fish"),
      "/boards?type=fish&q=fish",
    )
  })

  it("is synchronous so Enter does not wait on the network", () => {
    const href = hrefForNavMarketplaceSearch("channel islands")
    assert.equal(typeof href, "string")
    assert.equal(href.startsWith("/search?"), true)
    assert.equal(href.includes("nq=1"), true)
  })
})
