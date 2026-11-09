import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_GALLERY_EMBLA_WATCH_DRAG,
  LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX,
  listingGallerySwipeDirection,
  listingGalleryTouchOnVideoControls,
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

describe("listingGalleryTouchOnVideoControls", () => {
  const videoBottom = 400

  it("keeps the native control bar out of the carousel swipe", () => {
    assert.equal(
      listingGalleryTouchOnVideoControls(videoBottom - 4, videoBottom),
      true,
    )
    assert.equal(
      listingGalleryTouchOnVideoControls(
        videoBottom - LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX,
        videoBottom,
      ),
      true,
    )
  })

  it("lets a flick on the video picture change slides", () => {
    assert.equal(
      listingGalleryTouchOnVideoControls(
        videoBottom - LISTING_GALLERY_VIDEO_CONTROLS_STRIP_PX - 1,
        videoBottom,
      ),
      false,
    )
    assert.equal(listingGalleryTouchOnVideoControls(12, videoBottom), false)
    assert.equal(listingGalleryTouchOnVideoControls(Number.NaN, videoBottom), false)
  })
})
