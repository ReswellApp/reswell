import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingImageSiblingPublicUrls,
  listingImageStandInObjectPaths,
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

describe("listingImageStandInObjectPaths", () => {
  it("fills a missing thumb from the film, then the card", () => {
    assert.deepEqual(listingImageStandInObjectPaths("user/1791512250743-photo-thumb.webp"), [
      "user/1791512250743-photo-film2.webp",
      "user/1791512250743-photo-film2.jpg",
      "user/1791512250743-photo-card2.webp",
      "user/1791512250743-photo-card2.jpg",
      "user/1791512250743-photo-film.webp",
      "user/1791512250743-photo-film.jpg",
      "user/1791512250743-photo-card.webp",
      "user/1791512250743-photo-card.jpg",
    ])
  })

  it("fills a missing full-size file from the card, then the film", () => {
    assert.deepEqual(listingImageStandInObjectPaths("user/1791512250743-photo-full.jpg"), [
      "user/1791512250743-photo-card2.jpg",
      "user/1791512250743-photo-card2.webp",
      "user/1791512250743-photo-film2.jpg",
      "user/1791512250743-photo-film2.webp",
      "user/1791512250743-photo-card.jpg",
      "user/1791512250743-photo-card.webp",
      "user/1791512250743-photo-film.jpg",
      "user/1791512250743-photo-film.webp",
    ])
  })

  it("leaves card, film, and other files on their own path", () => {
    assert.deepEqual(listingImageStandInObjectPaths("user/1791512250743-photo-card2.webp"), [])
    assert.deepEqual(listingImageStandInObjectPaths("user/1791512250743-photo-film2.webp"), [])
    assert.deepEqual(listingImageStandInObjectPaths("user/1-video-poster.webp"), [])
  })
})
