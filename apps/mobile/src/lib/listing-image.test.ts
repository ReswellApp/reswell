import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_GALLERY_LOAD_RADIUS,
  listingGalleryPhotoIsNear,
  listingImageRecyclingKey,
} from "./listing-image.ts"

describe("listing gallery load window", () => {
  it("loads the current photo and its neighbors only", () => {
    assert.equal(LISTING_GALLERY_LOAD_RADIUS, 1)
    assert.equal(listingGalleryPhotoIsNear(0, 0), true)
    assert.equal(listingGalleryPhotoIsNear(1, 0), true)
    assert.equal(listingGalleryPhotoIsNear(2, 0), false)
    assert.equal(listingGalleryPhotoIsNear(0, 4), false)
    assert.equal(listingGalleryPhotoIsNear(3, 4), true)
    assert.equal(listingGalleryPhotoIsNear(5, 4), true)
    assert.equal(listingGalleryPhotoIsNear(6, 4), false)
  })
})

describe("listing image recycling key", () => {
  it("uses the uri, and listing id when present", () => {
    assert.equal(listingImageRecyclingKey("https://cdn.example/a.webp"), "https://cdn.example/a.webp")
    assert.equal(
      listingImageRecyclingKey("https://cdn.example/a.webp", "listing-1"),
      "listing-1:https://cdn.example/a.webp",
    )
  })
})
