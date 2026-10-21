import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import {
  clearPaintedListingPhotos,
  listingPhotoWasPainted,
  rememberPaintedListingPhoto,
  resolveListingPhotoPainted,
} from "./listing-photo-paint.ts"

describe("resolveListingPhotoPainted", () => {
  it("keeps a memory-cached photo painted, including when the candidate list remounts", () => {
    assert.equal(
      resolveListingPhotoPainted({ candidatesChanged: true, cached: true, loaded: false }),
      true,
    )
    assert.equal(
      resolveListingPhotoPainted({ candidatesChanged: false, cached: true, loaded: false }),
      true,
    )
  })

  it("does not clear a decoded photo just because the tile mounted again", () => {
    assert.equal(
      resolveListingPhotoPainted({ candidatesChanged: false, cached: false, loaded: true }),
      true,
    )
  })

  it("starts an uncached candidate change on the shimmer", () => {
    assert.equal(
      resolveListingPhotoPainted({ candidatesChanged: true, cached: false, loaded: true }),
      false,
    )
    assert.equal(
      resolveListingPhotoPainted({ candidatesChanged: false, cached: false, loaded: false }),
      false,
    )
  })
})

describe("painted listing photo session", () => {
  it("remembers a URL for the next tile mount and ignores empty placeholders", () => {
    clearPaintedListingPhotos()
    assert.equal(listingPhotoWasPainted("/media/listings/a.jpg"), false)
    rememberPaintedListingPhoto("/media/listings/a.jpg")
    assert.equal(listingPhotoWasPainted("/media/listings/a.jpg"), true)
    assert.equal(listingPhotoWasPainted("/placeholder.svg"), false)
    rememberPaintedListingPhoto("/placeholder.svg")
    assert.equal(listingPhotoWasPainted("/placeholder.svg"), false)
    clearPaintedListingPhotos()
  })
})

describe("listing photo wells", () => {
  it("gates the tile shimmer on the cached-photo hook and does not reset it after paint", () => {
    const src = readFileSync(
      new URL("../components/listing-tile-image-media.tsx", import.meta.url),
      "utf8",
    )
    assert.match(src, /useCachedPhotoReady/)
    assert.doesNotMatch(src, /setActiveLoaded\(false\)/)
    assert.doesNotMatch(src, /setLoaded\(false\)/)
  })

  it("does not fade the shimmer veil in over a photo", () => {
    const src = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8")
    assert.doesNotMatch(src, /\.listing-tile-shimmer-overlay\s*\{[^}]*transition/)
  })
})
