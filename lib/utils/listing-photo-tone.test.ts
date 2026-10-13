import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isValidListingMediaObjectPath } from "@/lib/listing-media-proxy-path-validation"
import {
  LISTING_PHOTO_TONE_IDENTITY,
  applyListingPhotoToneToPixels,
  clampListingPhotoTone,
  isListingPhotoToneIdentity,
  listingPhotoToneColumnValues,
  listingPhotoToneFromImageRow,
  listingPhotoToneObjectsToRemove,
  listingPhotoToneRgb,
  listingPhotoToneSourceUrl,
  listingPhotoToneStoragePaths,
  listingPhotoTonesEqual,
} from "./listing-photo-tone.ts"

describe("listingPhotoToneFromImageRow", () => {
  it("treats missing columns as no adjustment", () => {
    assert.deepEqual(listingPhotoToneFromImageRow(null), LISTING_PHOTO_TONE_IDENTITY)
    assert.deepEqual(listingPhotoToneFromImageRow({}), LISTING_PHOTO_TONE_IDENTITY)
    assert.equal(isListingPhotoToneIdentity(null), true)
  })

  it("reads PostgREST numeric strings and clamps", () => {
    assert.deepEqual(
      listingPhotoToneFromImageRow({
        tone_brightness: "12",
        tone_highlights: "-40",
        tone_shadows: 200,
        tone_contrast: "-3.2",
      }),
      { brightness: 12, highlights: -40, shadows: 100, contrast: -3 },
    )
  })
})

describe("listingPhotoToneRgb", () => {
  it("leaves identity pixels unchanged", () => {
    assert.deepEqual(listingPhotoToneRgb(17, 80, 210, LISTING_PHOTO_TONE_IDENTITY), [17, 80, 210])
  })

  it("raises and lowers brightness", () => {
    const [brighter] = listingPhotoToneRgb(128, 128, 128, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: 40,
    })
    const [darker] = listingPhotoToneRgb(128, 128, 128, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: -40,
    })
    assert.ok(brighter > 128)
    assert.ok(darker < 128)
  })

  it("pushes contrast away from mid gray", () => {
    const [light] = listingPhotoToneRgb(200, 200, 200, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      contrast: 80,
    })
    const [dark] = listingPhotoToneRgb(60, 60, 60, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      contrast: 80,
    })
    assert.ok(light > 200)
    assert.ok(dark < 60)
  })

  it("lifts shadows without moving a near-white pixel as much", () => {
    const tone = { ...LISTING_PHOTO_TONE_IDENTITY, shadows: 50 }
    const [shadow] = listingPhotoToneRgb(30, 30, 30, tone)
    const [white] = listingPhotoToneRgb(245, 245, 245, tone)
    assert.ok(shadow - 30 > white - 245)
    assert.ok(shadow > 30)
  })

  it("pulls highlights without crushing a near-black pixel as much", () => {
    const tone = { ...LISTING_PHOTO_TONE_IDENTITY, highlights: -50 }
    const [highlight] = listingPhotoToneRgb(230, 230, 230, tone)
    const [black] = listingPhotoToneRgb(12, 12, 12, tone)
    assert.ok(230 - highlight > 12 - black)
    assert.ok(highlight < 230)
  })

  it("keeps a neutral pixel neutral", () => {
    const [r, g, b] = listingPhotoToneRgb(90, 90, 90, {
      brightness: 15,
      highlights: -20,
      shadows: 25,
      contrast: 10,
    })
    assert.equal(r, g)
    assert.equal(g, b)
  })
})

describe("applyListingPhotoToneToPixels", () => {
  it("skips alpha and leaves identity buffers untouched", () => {
    const pixels = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 128])
    const copy = new Uint8ClampedArray(pixels)
    applyListingPhotoToneToPixels(pixels, 4, LISTING_PHOTO_TONE_IDENTITY)
    assert.deepEqual(pixels, copy)
  })

  it("writes RGB and keeps alpha", () => {
    const pixels = new Uint8ClampedArray([128, 128, 128, 200])
    applyListingPhotoToneToPixels(pixels, 4, {
      ...LISTING_PHOTO_TONE_IDENTITY,
      brightness: 30,
    })
    assert.ok(pixels[0] > 128)
    assert.equal(pixels[3], 200)
  })
})

describe("listingPhotoToneObjectsToRemove", () => {
  const source = "https://app.reswell.app/storage/v1/object/public/listings/user/1-full.webp"
  const baked = "https://app.reswell.app/storage/v1/object/public/listings/user/2-full.webp"

  it("keeps the original on the first bake", () => {
    assert.deepEqual(
      listingPhotoToneObjectsToRemove({
        previousFullUrl: source,
        previousThumbUrl: source.replace("-full.", "-thumb."),
        sourceFullUrl: source,
      }),
      [],
    )
  })

  it("removes the previous baked full, thumb, card, and film", () => {
    assert.deepEqual(
      listingPhotoToneObjectsToRemove({
        previousFullUrl: baked,
        previousThumbUrl: baked.replace("-full.", "-thumb."),
        sourceFullUrl: source,
      }),
      [
        baked,
        baked.replace("-full.", "-thumb."),
        baked.replace("-full.", "-card2."),
        baked.replace("-full.", "-film2."),
      ],
    )
  })
})

describe("listingPhotoTone helpers", () => {
  it("compares clamped stops and clears identity columns", () => {
    assert.equal(
      listingPhotoTonesEqual({ brightness: 1.2, highlights: 0, shadows: 0, contrast: 0 }, {
        brightness: 1,
        highlights: 0,
        shadows: 0,
        contrast: 0,
      }),
      true,
    )
    assert.deepEqual(listingPhotoToneColumnValues(LISTING_PHOTO_TONE_IDENTITY), {
      tone_brightness: null,
      tone_highlights: null,
      tone_shadows: null,
      tone_contrast: null,
    })
    assert.equal(clampListingPhotoTone({ brightness: 4 }).brightness, 4)
  })

  it("builds proxy-safe derivative paths", () => {
    const ownerId = "11111111-1111-4111-8111-111111111111"
    const imageId = "22222222-2222-4222-8222-222222222222"
    const paths = listingPhotoToneStoragePaths(ownerId, "m5k2a0", imageId)
    assert.equal(paths.full.endsWith("-full.webp"), true)
    assert.equal(paths.card.includes("-card2."), true)
    assert.equal(paths.film.includes("-film2."), true)
    for (const path of Object.values(paths)) {
      assert.equal(isValidListingMediaObjectPath(path), true)
    }
  })

  it("prefers the stored source url", () => {
    assert.equal(
      listingPhotoToneSourceUrl({ url: "baked", tone_source_url: " original " }),
      "original",
    )
    assert.equal(listingPhotoToneSourceUrl({ url: "current" }), "current")
  })
})
