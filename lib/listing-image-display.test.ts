import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  LISTING_TILE_GALLERY_MAX_IMAGES,
  coalesceListingImagesForCard,
  listingCoverImageForCard,
  listingFilmImageSrcFromRow,
  listingImagesFromPrimaryFields,
  listingTileCarouselImageCandidateLists,
  listingTileImageSrcCandidatesFromRow,
  listingTitleThumbnailCandidates,
} from "./listing-image-display.ts"

const STORAGE = "https://proj.supabase.co/storage/v1/object/public/listings"

describe("listingImagesFromPrimaryFields", () => {
  it("falls back to a single cover when the gallery is empty", () => {
    const images = listingImagesFromPrimaryFields(
      "https://cdn.example/full.webp",
      "https://cdn.example/thumb.webp",
      [],
    )
    assert.deepEqual(images, [
      {
        url: "https://cdn.example/full.webp",
        thumbnail_url: "https://cdn.example/thumb.webp",
        is_primary: true,
      },
    ])
  })

  it("uses the denormalized gallery so tiles can page without a join", () => {
    const images = listingImagesFromPrimaryFields(
      "https://cdn.example/cover.webp",
      "https://cdn.example/cover-thumb.webp",
      [
        { url: "https://cdn.example/1.webp", thumbnail_url: "https://cdn.example/1-t.webp" },
        { url: "https://cdn.example/2.webp", thumbnail_url: null },
      ],
    )
    assert.equal(images?.length, 2)
    assert.equal(images?.[0]?.is_primary, true)
    assert.equal(images?.[1]?.url, "https://cdn.example/2.webp")
    assert.equal(listingTileCarouselImageCandidateLists(images).length, 2)
  })

  it("caps a malformed oversized gallery", () => {
    const images = listingImagesFromPrimaryFields(
      null,
      null,
      Array.from({ length: LISTING_TILE_GALLERY_MAX_IMAGES + 5 }, (_, i) => ({
        url: `https://cdn.example/${i}.webp`,
      })),
    )
    assert.equal(images?.length, LISTING_TILE_GALLERY_MAX_IMAGES)
  })
})

describe("listing tile vs compact thumb sources", () => {
  it("serves marketplace tiles from the stored card derivative, not the stored 640px thumb", () => {
    const candidates = listingTileImageSrcCandidatesFromRow({
      url: `${STORAGE}/u/1-full.webp`,
      thumbnail_url: `${STORAGE}/u/1-thumb.webp`,
    })
    assert.equal(candidates[0], "/media/listings/u/1-card2.webp")
    assert.equal(
      listingFilmImageSrcFromRow({
        url: `${STORAGE}/u/1-full.webp`,
        thumbnail_url: `${STORAGE}/u/1-thumb.webp`,
      }),
      "/media/listings/u/1-film2.webp",
    )
    assert.equal(
      candidates.some((src) => src.includes("-thumb.")),
      false,
    )
  })

  it("rewrites a thumb-only url to the card derivative", () => {
    const candidates = listingTileImageSrcCandidatesFromRow({
      url: `${STORAGE}/u/1-thumb.webp`,
    })
    assert.equal(candidates[0], "/media/listings/u/1-card2.webp")
  })

  it("keeps compact rows on the stored thumb", () => {
    const candidates = listingTitleThumbnailCandidates([
      {
        url: `${STORAGE}/u/1-full.webp`,
        thumbnail_url: `${STORAGE}/u/1-thumb.webp`,
        is_primary: true,
      },
    ])
    assert.equal(candidates[0], "/media/listings/u/1-thumb.webp")
    assert.equal(candidates[1], "/media/listings/u/1-card2.webp")
  })
})

describe("listingCoverImageForCard", () => {
  it("keeps the primary photo and drops the rest of the gallery", () => {
    const images = listingCoverImageForCard([
      { url: "https://cdn.example/2.webp", thumbnail_url: "https://cdn.example/2-t.webp" },
      {
        url: "https://cdn.example/1.webp",
        thumbnail_url: "https://cdn.example/1-t.webp",
        is_primary: true,
      },
    ])
    assert.deepEqual(images, [{ url: "https://cdn.example/1.webp", is_primary: true }])
  })
})

describe("coalesceListingImagesForCard", () => {
  it("prefers a real listing_images join when present", () => {
    const images = coalesceListingImagesForCard({
      listing_images: [
        { url: "https://cdn.example/joined.webp", is_primary: true },
        { url: "https://cdn.example/joined-2.webp" },
      ],
      primary_image_url: "https://cdn.example/cover.webp",
      tile_gallery_images: [{ url: "https://cdn.example/denorm.webp" }],
    })
    assert.equal(images?.[0]?.url, "https://cdn.example/joined.webp")
    assert.equal(images?.length, 2)
  })

  it("hydrates from tile_gallery_images when the join is omitted", () => {
    const images = coalesceListingImagesForCard({
      primary_image_url: "https://cdn.example/cover.webp",
      primary_thumbnail_url: "https://cdn.example/cover-t.webp",
      tile_gallery_images: [
        { url: "https://cdn.example/a.webp", thumbnail_url: "https://cdn.example/a-t.webp" },
        { url: "https://cdn.example/b.webp" },
      ],
    })
    assert.equal(images?.length, 2)
    assert.equal(images?.[0]?.url, "https://cdn.example/a.webp")
  })
})
