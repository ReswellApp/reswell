import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { pickModelPageListingWithImage } from "./listing-image.ts"

describe("pickModelPageListingWithImage", () => {
  it("prefers the top pick when it has a photo", () => {
    const top = { id: "top", listing_images: [{ url: "https://cdn.example.com/top.jpg" }] }
    const other = { id: "other", listing_images: [{ url: "https://cdn.example.com/other.jpg" }] }
    assert.equal(pickModelPageListingWithImage([other, top], top), top)
  })

  it("skips a top pick without a photo", () => {
    const top = { id: "top", listing_images: [] }
    const other = { id: "other", listing_images: [{ url: "https://cdn.example.com/other.jpg" }] }
    assert.equal(pickModelPageListingWithImage([top, other], top), other)
  })

  it("returns null when no listing has a photo", () => {
    assert.equal(pickModelPageListingWithImage([{ listing_images: [] }], { listing_images: [] }), null)
  })
})
