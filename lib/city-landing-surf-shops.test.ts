import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  findSurfShopBySlug,
  surfShopHref,
  surfShopsForCity,
} from "./city-landing-surf-shops.ts"

describe("surfShopsForCity", () => {
  it("includes Channel Islands and Mollusk on Santa Barbara", () => {
    const shops = surfShopsForCity({ slug: "santa-barbara", city: "Santa Barbara" })
    assert.deepEqual(
      shops.map((shop) => shop.slug),
      [
        "rincon-designs",
        "beach-house-santa-barbara",
        "channel-islands-surfboards",
        "mollusk-santa-barbara",
      ],
    )
  })

  it("keeps the San Francisco Mollusk on its own city page", () => {
    const shops = surfShopsForCity({ slug: "san-francisco", city: "San Francisco" })
    assert.deepEqual(
      shops.map((shop) => shop.slug),
      ["mollusk-surf-shop"],
    )
  })
})

describe("findSurfShopBySlug", () => {
  it("resolves the Santa Barbara Channel Islands and Mollusk shops", () => {
    const channelIslands = findSurfShopBySlug("channel-islands-surfboards")
    assert.ok(channelIslands)
    assert.equal(channelIslands.name, "Channel Islands Surfboards")
    assert.equal(channelIslands.address, "36 Anacapa St, Santa Barbara, CA 93101")
    assert.equal(surfShopHref(channelIslands.slug), "/surf-shops/channel-islands-surfboards")

    const mollusk = findSurfShopBySlug("mollusk-santa-barbara")
    assert.ok(mollusk)
    assert.equal(mollusk.name, "Mollusk Surf Shop")
    assert.equal(mollusk.city, "Santa Barbara")
    assert.equal(mollusk.address, "208 Gray Ave, Santa Barbara, CA 93101")
    assert.equal(surfShopHref(mollusk.slug), "/surf-shops/mollusk-santa-barbara")
  })
})
