import assert from "node:assert/strict"
import test from "node:test"

import {
  listingMediaSignature,
  listingMediaUnchanged,
} from "./listing-media-unchanged.ts"
import { listingEditReturnMode } from "./navigate-after-listing-save.ts"

const image = {
  id: "img-1",
  url: "https://cdn.example/a.jpg",
  thumbnailUrl: "https://cdn.example/a-thumb.jpg",
}

test("listing media signature changes when a photo url changes", () => {
  const loaded = listingMediaSignature({
    images: [image],
    removedImageIds: [],
    video: null,
    removedVideoIds: [],
  })
  assert.equal(
    listingMediaUnchanged(loaded, {
      images: [image],
      removedImageIds: [],
      video: null,
      removedVideoIds: [],
    }),
    true,
  )
  assert.equal(
    listingMediaUnchanged(loaded, {
      images: [{ ...image, url: "https://cdn.example/b.jpg" }],
      removedImageIds: [],
      video: null,
      removedVideoIds: [],
    }),
    false,
  )
})

test("listing media signature changes when a photo is removed", () => {
  const loaded = listingMediaSignature({
    images: [image],
    removedImageIds: [],
    video: null,
    removedVideoIds: [],
  })
  assert.equal(
    listingMediaUnchanged(loaded, {
      images: [],
      removedImageIds: [image.id],
      video: null,
      removedVideoIds: [],
    }),
    false,
  )
})

test("listing edit returns back when the tab has a previous screen", () => {
  assert.equal(listingEditReturnMode(1), "assign")
  assert.equal(listingEditReturnMode(2), "back")
})
