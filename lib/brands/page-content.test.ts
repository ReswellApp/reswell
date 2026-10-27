import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  brandAboutParagraphs,
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
