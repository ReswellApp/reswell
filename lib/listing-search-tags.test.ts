import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  isListingSearchTagSlug,
  listingSearchTagLabel,
  listingSearchTagSlugsForStyles,
  listingSearchTagsOverlapOrPart,
  normalizeListingSearchTag,
  parseListingSearchTags,
  serializeListingSearchTags,
} from "./listing-search-tags.ts"

describe("normalizeListingSearchTag", () => {
  it("lowercases and hyphenates", () => {
    assert.equal(normalizeListingSearchTag(" Fish "), "fish")
    assert.equal(normalizeListingSearchTag("Step Up"), "step-up")
    assert.equal(normalizeListingSearchTag("twinzer"), "twinzer")
  })
})

describe("isListingSearchTagSlug", () => {
  it("accepts fish and other board-style slugs", () => {
    assert.equal(isListingSearchTagSlug("fish"), true)
    assert.equal(isListingSearchTagSlug("step-up-gun"), true)
    assert.equal(isListingSearchTagSlug("x"), false)
    assert.equal(isListingSearchTagSlug("Fish"), false)
  })
})

describe("parseListingSearchTags", () => {
  it("reads a Postgres text[] and drops junk", () => {
    assert.deepEqual(parseListingSearchTags(["fish", "Fish", "nope!", "twinzer"]), [
      "fish",
      "twinzer",
    ])
  })

  it("reads a comma list", () => {
    assert.deepEqual(parseListingSearchTags("fish, groveler"), ["fish", "groveler"])
  })
})

describe("serializeListingSearchTags", () => {
  it("dedupes and caps the list", () => {
    assert.deepEqual(serializeListingSearchTags(["Fish", "fish", "shortboard"]), [
      "fish",
      "shortboard",
    ])
  })
})

describe("listingSearchTagSlugsForStyles", () => {
  it("canonicalizes aliases so hybrid browse matches a hybrid tag", () => {
    assert.deepEqual(listingSearchTagSlugsForStyles(["fish", "funboard", "gun"]), [
      "fish",
      "hybrid",
      "step-up-gun",
    ])
  })
})

describe("listingSearchTagsOverlapOrPart", () => {
  it("builds a PostgREST overlap clause for fish", () => {
    assert.equal(listingSearchTagsOverlapOrPart(["fish"]), "search_tags.ov.{fish}")
  })
})

describe("listingSearchTagLabel", () => {
  it("uses the Fish preset label", () => {
    assert.equal(listingSearchTagLabel("fish"), "Fish")
  })
})
