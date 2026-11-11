import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  fingerprintCacheKey,
  redisForwardGeocodeKey,
  redisMobileListingCacheKeys,
  redisMobileListingKey,
  redisMobileTypeaheadKey,
  redisPlacesSuggestKey,
  redisRateLimitKey,
  redisSearchSuggestKey,
  redisShippingRatesKey,
} from "./keys.ts"

describe("redis keys", () => {
  it("normalizes search queries so typeahead casing shares a key", () => {
    assert.equal(redisSearchSuggestKey("marketplace", " Album Twin "), redisSearchSuggestKey("marketplace", "album twin"))
    assert.equal(redisMobileTypeaheadKey("Lost  "), redisMobileTypeaheadKey("lost"))
  })

  it("keeps geocode and shipping keys namespaced", () => {
    assert.equal(redisPlacesSuggestKey("Santa Cruz").startsWith("cache:geo:places:"), true)
    assert.equal(redisPlacesSuggestKey("google:Santa Cruz").includes("google:santa cruz"), true)
    assert.equal(redisForwardGeocodeKey("Santa Cruz, CA").includes("santa cruz, ca"), true)
    assert.equal(redisShippingRatesKey("abc").startsWith("cache:ship:rates:"), true)
    assert.equal(redisRateLimitKey("mobile:search", "1.1.1.1"), "rl:mobile:search:1.1.1.1")
  })

  it("expires listing PDP and rails keys for both id and slug", () => {
    const keys = redisMobileListingCacheKeys("Abc-Id", "Album-Twin")
    assert.equal(keys.includes(redisMobileListingKey("abc-id")), true)
    assert.equal(keys.includes(redisMobileListingKey("album-twin")), true)
    assert.equal(keys.some((key) => key.includes("listing-rails")), true)
  })

  it("hashes fingerprints to a stable 32-char hex", () => {
    const first = fingerprintCacheKey("from|to|12x4x4")
    const second = fingerprintCacheKey("from|to|12x4x4")
    assert.equal(first, second)
    assert.equal(first.length, 32)
    assert.notEqual(fingerprintCacheKey("from|to|12x4x5"), first)
  })
})
