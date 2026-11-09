import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  brandAboutParagraphs,
  brandDirectoryBlurb,
  brandStoryLead,
  brandStoryParagraphs,
} from "@/lib/brands/page-content"

describe("brandAboutParagraphs", () => {
  it("filters non-strings and trims", () => {
    assert.deepEqual(brandAboutParagraphs(["  hello ", "", 3, "world"]), ["hello", "world"])
  })
})

describe("brandStoryParagraphs", () => {
  it("prefers about paragraphs over short description", () => {
    assert.deepEqual(
      brandStoryParagraphs({
        short_description: "Tagline",
        about_paragraphs: ["History one", "History two"],
      }),
      ["History one", "History two"],
    )
  })

  it("falls back to short description", () => {
    assert.deepEqual(
      brandStoryParagraphs({ short_description: "Only blurb", about_paragraphs: [] }),
      ["Only blurb"],
    )
  })
})

describe("brandStoryLead", () => {
  it("shows lead only when long-form exists", () => {
    assert.equal(
      brandStoryLead({ short_description: "Tag", about_paragraphs: ["Long"] }),
      "Tag",
    )
    assert.equal(brandStoryLead({ short_description: "Tag", about_paragraphs: [] }), null)
  })
})

describe("brandDirectoryBlurb", () => {
  it("returns null for empty copy", () => {
    assert.equal(brandDirectoryBlurb(null), null)
    assert.equal(brandDirectoryBlurb("   "), null)
  })

  it("keeps a short description intact", () => {
    assert.equal(
      brandDirectoryBlurb("Al Merrick performance shortboards and everyday drivers."),
      "Al Merrick performance shortboards and everyday drivers.",
    )
  })

  it("unwraps a quoted bio and takes the first sentence when long", () => {
    const quoted =
      '"It all began in a garage with a broken longboard. After years studying coastal engineering, 11th Street Surfboards was born. Today every board is crafted by me and my son."'
    assert.equal(
      brandDirectoryBlurb(quoted),
      "It all began in a garage with a broken longboard.",
    )
  })

  it("clips a long sentence at a word boundary", () => {
    const long =
      "This is a single very long sentence without a period that just keeps going with more and more words about a surfboard brand from somewhere on the coast until it is far too long for a directory card"
    const blurb = brandDirectoryBlurb(long)
    assert.ok(blurb)
    assert.ok(blurb.endsWith("…"))
    assert.ok(blurb.length <= 160)
  })
})
