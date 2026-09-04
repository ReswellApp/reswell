import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingDerivedThumbUrlFromFullUrl,
  listingStoredThumbIsDistinctFromFull,
  persistableListingThumbnailUrl,
} from "./listing-thumb-url.ts"

const STORAGE = "https://abc.supabase.co/storage/v1/object/public/listings"

describe("listingStoredThumbIsDistinctFromFull", () => {
  it("accepts a persisted thumb that is not the full object", () => {
    assert.equal(
      listingStoredThumbIsDistinctFromFull(`${STORAGE}/u/1-thumb.webp`, `${STORAGE}/u/1-full.webp`),
      true,
    )
  })

  it("rejects a missing thumb so grids do not guess *-thumb. paths", () => {
    assert.equal(listingStoredThumbIsDistinctFromFull(null, `${STORAGE}/u/1-full.webp`), false)
    assert.equal(listingStoredThumbIsDistinctFromFull("", `${STORAGE}/u/1-full.webp`), false)
  })

  it("rejects thumbnail_url when it is a copy of the full URL", () => {
    const full = `${STORAGE}/u/import-1.jpg`
    assert.equal(listingStoredThumbIsDistinctFromFull(full, full), false)
  })
})

describe("persistableListingThumbnailUrl", () => {
  it("keeps an explicit thumb", () => {
    assert.equal(
      persistableListingThumbnailUrl("https://cdn.example/thumb.webp", "https://cdn.example/full.webp"),
      "https://cdn.example/thumb.webp",
    )
  })

  it("derives the pair-upload sibling when the thumb was omitted", () => {
    assert.equal(
      persistableListingThumbnailUrl(null, `${STORAGE}/u/9-full.webp`),
      `${STORAGE}/u/9-thumb.webp`,
    )
  })

  it("does not invent a thumb for non-pair URLs", () => {
    assert.equal(persistableListingThumbnailUrl(null, `${STORAGE}/u/import-1.jpg`), null)
    assert.equal(listingDerivedThumbUrlFromFullUrl(`${STORAGE}/u/import-1.jpg`), null)
  })
})
