import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { modelPageHeroImage, pickModelPageListingWithImage } from "./listing-image.ts"

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

describe("modelPageHeroImage", () => {
  it("uses a live listing photo ahead of a sold one", () => {
    assert.deepEqual(
      modelPageHeroImage({
        livePhotoUrl: "https://cdn.example.com/live.jpg",
        soldPhotoUrl: "https://cdn.example.com/sold.jpg",
        fallbackSoldUrl: "https://cdn.example.com/older.jpg",
      }),
      { url: "https://cdn.example.com/live.jpg", source: "live" },
    )
  })

  it("uses a past sale when nothing is live", () => {
    assert.deepEqual(
      modelPageHeroImage({
        livePhotoUrl: null,
        soldPhotoUrl: "https://cdn.example.com/sold.jpg",
        fallbackSoldUrl: "https://cdn.example.com/older.jpg",
      }),
      { url: "https://cdn.example.com/sold.jpg", source: "sold" },
    )
  })

  it("uses the sold fallback when the sold rows have no photo", () => {
    assert.deepEqual(
      modelPageHeroImage({
        livePhotoUrl: "  ",
        soldPhotoUrl: null,
        fallbackSoldUrl: "https://cdn.example.com/older.jpg",
      }),
      { url: "https://cdn.example.com/older.jpg", source: "sold" },
    )
  })

  it("returns no photo when no listing has one", () => {
    assert.deepEqual(
      modelPageHeroImage({ livePhotoUrl: null, soldPhotoUrl: null, fallbackSoldUrl: null }),
      { url: null, source: "none" },
    )
  })
})
