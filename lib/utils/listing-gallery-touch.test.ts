import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_GALLERY_EMBLA_WATCH_DRAG,
  listingGallerySwipeDirection,
} from "./listing-gallery-touch.ts"

describe("listing gallery drag policy", () => {
  it("never lets Embla install its blocking touchmove listener", () => {
    assert.equal(LISTING_GALLERY_EMBLA_WATCH_DRAG, false)
  })
})

describe("listingGallerySwipeDirection", () => {
  it("treats a horizontal flick as a photo change", () => {
    assert.equal(listingGallerySwipeDirection(-40, 4), 1)
    assert.equal(listingGallerySwipeDirection(40, -6), -1)
  })

  it("lets taps and vertical scrolls through", () => {
    assert.equal(listingGallerySwipeDirection(4, 2), null)
    assert.equal(listingGallerySwipeDirection(6, -80), null)
    assert.equal(listingGallerySwipeDirection(-20, -30), null)
    assert.equal(listingGallerySwipeDirection(Number.NaN, 40), null)
  })
})
