import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  filterHomeRecentlyListedFeatureListings,
  isHomeRecentlyListedFeatureCondition,
  isHomeRecentlyListedFeatureListing,
  isHomeRecentlyListedFeatureTitle,
} from "./home-recently-listed-quality.ts"

describe("homepage recently listed quality", () => {
  it("keeps Very Good or better, including legacy new / like-new", () => {
    assert.equal(isHomeRecentlyListedFeatureCondition("very_good"), true)
    assert.equal(isHomeRecentlyListedFeatureCondition("excellent"), true)
    assert.equal(isHomeRecentlyListedFeatureCondition("brand_new"), true)
    assert.equal(isHomeRecentlyListedFeatureCondition("new"), true)
    assert.equal(isHomeRecentlyListedFeatureCondition("like_new"), true)
  })

  it("drops Good and worse", () => {
    assert.equal(isHomeRecentlyListedFeatureCondition("good"), false)
    assert.equal(isHomeRecentlyListedFeatureCondition("fair"), false)
    assert.equal(isHomeRecentlyListedFeatureCondition("poor"), false)
    assert.equal(isHomeRecentlyListedFeatureCondition(""), false)
    assert.equal(isHomeRecentlyListedFeatureCondition(null), false)
  })

  it("keeps long descriptive titles", () => {
    assert.equal(isHomeRecentlyListedFeatureTitle("6'6\" Christenson Lane Splitter"), true)
    assert.equal(
      isHomeRecentlyListedFeatureTitle("Brand New Futures JJ Large Tech Flex Surfboard Fins"),
      true,
    )
    assert.equal(isHomeRecentlyListedFeatureTitle("5'7\" Lost Surfboards Mayhem Fish"), true)
  })

  it("drops short, generic, or concatenated titles", () => {
    assert.equal(isHomeRecentlyListedFeatureTitle("CJ Nelson's 9'6 Sprout"), false)
    assert.equal(isHomeRecentlyListedFeatureTitle("Futures Thermotech TMF-1"), false)
    assert.equal(isHomeRecentlyListedFeatureTitle("6'6\"ChristensonLaneSplitter"), false)
    assert.equal(isHomeRecentlyListedFeatureTitle("Surfboard"), false)
    assert.equal(isHomeRecentlyListedFeatureTitle("Used fins"), false)
    assert.equal(isHomeRecentlyListedFeatureTitle(""), false)
  })

  it("requires both a feature condition and a long title", () => {
    assert.equal(
      isHomeRecentlyListedFeatureListing({
        title: "6'6\" Christenson Lane Splitter",
        condition: "very_good",
      }),
      true,
    )
    assert.equal(
      isHomeRecentlyListedFeatureListing({
        title: "6'6\" Christenson Lane Splitter",
        condition: "good",
      }),
      false,
    )
    assert.equal(
      isHomeRecentlyListedFeatureListing({
        title: "Board",
        condition: "very_good",
      }),
      false,
    )
  })

  it("filters a mixed pool down to qualifying listings", () => {
    const kept = filterHomeRecentlyListedFeatureListings([
      { id: "keep", title: "6'6\" Christenson Lane Splitter", condition: "very_good" },
      { id: "good-cond", title: "5'7\" Lost Surfboards Mayhem Fish", condition: "good" },
      { id: "short", title: "CJ Nelson Sprout", condition: "very_good" },
    ])
    assert.deepEqual(
      kept.map((row) => row.id),
      ["keep"],
    )
  })
})
