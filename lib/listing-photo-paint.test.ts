import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { listingImageIsDecoded } from "./listing-photo-paint.ts"

describe("listingImageIsDecoded", () => {
  it("is true only when the element has finished and has pixels", () => {
    assert.equal(listingImageIsDecoded(null), false)
    assert.equal(listingImageIsDecoded(undefined), false)
    assert.equal(listingImageIsDecoded({ complete: true, naturalWidth: 0 }), false)
    assert.equal(listingImageIsDecoded({ complete: false, naturalWidth: 800 }), false)
    assert.equal(listingImageIsDecoded({ complete: true, naturalWidth: 800 }), true)
  })
})

describe("listing photo wells", () => {
  it("checks the mounted image before paint and does not remember URLs", () => {
    const hook = readFileSync(
      new URL("../components/features/listings/hooks/use-listing-photo-ready.ts", import.meta.url),
      "utf8",
    )
    assert.match(hook, /useLayoutEffect/)
    assert.match(hook, /requestAnimationFrame/)
    assert.match(hook, /listingImageIsDecoded/)
    assert.doesNotMatch(hook, /rememberPaintedListingPhoto|new window\.Image|new Image\(/)

    const tile = readFileSync(
      new URL("../components/listing-tile-image-media.tsx", import.meta.url),
      "utf8",
    )
    assert.match(tile, /useListingPhotoReady/)
    assert.match(tile, /active && photo\.ready/)
    assert.doesNotMatch(tile, /setActiveLoaded\(false\)/)
    assert.doesNotMatch(tile, /setLoaded\(false\)/)
    assert.doesNotMatch(tile, /useCachedPhotoReady/)
  })

  it("does not fade the shimmer veil in over a photo", () => {
    const src = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    assert.doesNotMatch(src, /\.listing-tile-shimmer-overlay\s*\{[^}]*transition/)
  })
})
