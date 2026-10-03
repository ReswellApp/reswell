import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingGalleryShouldBlockEmblaDrag,
  listingGallerySwipeDirection,
} from "./listing-gallery-touch.ts"

const FACEBOOK_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/456.0.0.0.0;FBBV/1;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.4;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]"

const INSTAGRAM_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/21E219 Instagram 321.0.0.0.0 (iPhone15,2; iOS 17_4; en_US; en; scale=3.00; 1179x2556; 123)"

const SAFARI_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"

describe("listingGalleryShouldBlockEmblaDrag", () => {
  it("blocks Embla touch drag in Meta in-app browsers", () => {
    assert.equal(listingGalleryShouldBlockEmblaDrag(FACEBOOK_IOS), true)
    assert.equal(listingGalleryShouldBlockEmblaDrag(INSTAGRAM_IOS), true)
    assert.equal(
      listingGalleryShouldBlockEmblaDrag(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/450.0.0.0.0;]",
      ),
      true,
    )
  })

  it("keeps Embla drag for a fine pointer in Safari and Chrome", () => {
    assert.equal(listingGalleryShouldBlockEmblaDrag(SAFARI_IOS), false)
    assert.equal(
      listingGalleryShouldBlockEmblaDrag(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
      false,
    )
    assert.equal(listingGalleryShouldBlockEmblaDrag(null), false)
    assert.equal(listingGalleryShouldBlockEmblaDrag(""), false)
  })

  it("blocks Embla touch drag on a coarse pointer, including mobile Safari", () => {
    assert.equal(listingGalleryShouldBlockEmblaDrag(SAFARI_IOS, true), true)
    assert.equal(
      listingGalleryShouldBlockEmblaDrag(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        true,
      ),
      true,
    )
    assert.equal(listingGalleryShouldBlockEmblaDrag(null, true), true)
    assert.equal(listingGalleryShouldBlockEmblaDrag(SAFARI_IOS, false), false)
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
