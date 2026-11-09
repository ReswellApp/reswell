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
    assert.match(src, /img\.listing-photo-fill\s*\{[^}]*background-color:\s*transparent/)
  })

  it("does not cover a /l photo with the near-white shimmer", () => {
    const photo = readFileSync(
      new URL("../components/features/listings/listing-gallery-photo.tsx", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(photo, /ListingTileShimmer/)
    assert.doesNotMatch(photo, /transition-opacity/)
    assert.doesNotMatch(photo, /PHOTO_LAYER =[\s\S]*transform-gpu/)
    assert.match(photo, /preview && !sourcePaint\.ready \? "opacity-0"/)

    const loading = readFileSync(
      new URL("../app/l/[listing]/loading.tsx", import.meta.url),
      "utf8",
    )
    assert.doesNotMatch(loading, /ListingDetailRouteSkeleton/)
    assert.match(loading, /ListingDetailRoutePending/)

    const page = readFileSync(new URL("../app/l/[listing]/page.tsx", import.meta.url), "utf8")
    assert.doesNotMatch(page, /ListingDetailCachedShell/)
    // Catalog PDPs must not stream a photo-only Suspense shell ahead of the page.
    assert.doesNotMatch(
      page,
      /Suspense fallback=\{<ListingDetailCachedShell|Suspense fallback=\{<ListingDetailRouteSkeleton/,
    )
    assert.match(page, /ListingDetailPublicOrAuthenticated/)
  })
})
