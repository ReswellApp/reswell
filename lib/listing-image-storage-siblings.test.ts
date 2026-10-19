import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingImageSiblingPublicUrls,
  listingStorageUrlsToRemove,
} from "./listing-image-storage-siblings.ts"

const STORAGE = "https://abc.supabase.co/storage/v1/object/public/listings/user"
const FULL = `${STORAGE}/1791512250743-photo-full.webp`
const THUMB = `${STORAGE}/1791512250743-photo-thumb.webp`
const CARD = `${STORAGE}/1791512250743-photo-card2.webp`
const FILM = `${STORAGE}/1791512250743-photo-film2.webp`

describe("listingImageSiblingPublicUrls", () => {
  it("names the card and film objects that are not stored on the row", () => {
    assert.deepEqual(listingImageSiblingPublicUrls([FULL, THUMB]), [
      FULL,
      THUMB,
      CARD,
      FILM,
      `${STORAGE}/1791512250743-photo-card.webp`,
      `${STORAGE}/1791512250743-photo-film.webp`,
    ])
  })

  it("leaves video posters and unrelated files alone", () => {
    const poster = `${STORAGE}/1-video-poster.webp`
    const video = `${STORAGE}/1-video.mp4`
    assert.deepEqual(listingImageSiblingPublicUrls([poster, video]), [poster, video])
  })
})

describe("listingStorageUrlsToRemove", () => {
  it("keeps every sibling of a photo that is still on the listing", () => {
    const kept = `${STORAGE}/other-full.webp`
    assert.deepEqual(
      listingStorageUrlsToRemove([FULL], [kept]),
      listingImageSiblingPublicUrls([FULL]),
    )
    assert.deepEqual(listingStorageUrlsToRemove([THUMB], [FULL]), [])
  })
})
