import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findMetaCityCatalogMarket,
  metaCityCatalogLandingHref,
  resolveMetaCityCatalogMarkets,
} from "./city-catalog-feed.ts"

describe("findMetaCityCatalogMarket", () => {
  it("resolves santa-barbara and its city-state alias", () => {
    assert.equal(findMetaCityCatalogMarket("santa-barbara")?.customLabel, "SantaBarbara")
    assert.equal(findMetaCityCatalogMarket("santa-barbara-ca")?.locationLabel, "Santa Barbara, CA")
  })

  it("resolves ventura", () => {
    assert.equal(findMetaCityCatalogMarket("Ventura")?.slug, "ventura")
    assert.equal(findMetaCityCatalogMarket("ventura-ca")?.customLabel, "Ventura")
  })

  it("rejects unknown slugs", () => {
    assert.equal(findMetaCityCatalogMarket("malibu"), null)
    assert.equal(findMetaCityCatalogMarket(""), null)
  })
})

describe("resolveMetaCityCatalogMarkets", () => {
  it("defaults to Santa Barbara and Ventura", () => {
    const markets = resolveMetaCityCatalogMarkets(null)
    assert.deepEqual(markets?.map((market) => market.slug), ["santa-barbara", "ventura"])
  })

  it("narrows to one city", () => {
    const markets = resolveMetaCityCatalogMarkets("ventura")
    assert.deepEqual(markets?.map((market) => market.slug), ["ventura"])
  })

  it("returns null for an unknown city", () => {
    assert.equal(resolveMetaCityCatalogMarkets("oxnard"), null)
  })
})

describe("metaCityCatalogLandingHref", () => {
  it("points at the public city landing pages", () => {
    assert.equal(metaCityCatalogLandingHref("santa-barbara"), "/reswell/santa-barbara")
    assert.equal(metaCityCatalogLandingHref("ventura"), "/reswell/ventura")
  })
})
