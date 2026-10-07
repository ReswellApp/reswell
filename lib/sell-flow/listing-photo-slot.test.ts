import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  listingPhotoTilePreviewSrc,
  listingPhotoTileSkeletonVisible,
  type ListingPhotoSlot,
} from "./listing-photo-slot.ts"
import { swapListingPhotoPreviewToPreparedThumb } from "./reveal-listing-photo-preview.ts"

function slot(partial: Partial<ListingPhotoSlot>): ListingPhotoSlot {
  return {
    clientId: "photo-1",
    previewUrl: "blob:https://reswell.com/original",
    optimizePhase: "running",
    uploadPhase: "idle",
    progressFull: 0,
    progressThumb: 0,
    ...partial,
  }
}

describe("listingPhotoTilePreviewSrc", () => {
  it("hides the original camera file until a derivative is ready", () => {
    assert.equal(listingPhotoTilePreviewSrc(slot({})), "")
  })

  it("shows the local derivative while optimize and upload are still running", () => {
    const preview = "blob:https://reswell.com/thumb"
    assert.equal(
      listingPhotoTilePreviewSrc(
        slot({
          previewUrl: preview,
          localPreviewReady: true,
          optimizePhase: "running",
          uploadPhase: "idle",
        }),
      ),
      preview,
    )
    assert.equal(
      listingPhotoTilePreviewSrc(
        slot({
          previewUrl: preview,
          localPreviewReady: true,
          optimizePhase: "done",
          uploadPhase: "uploading",
          url: "https://cdn.example/full.webp",
          thumbnailUrl: "https://cdn.example/thumb.webp",
        }),
      ),
      preview,
    )
  })

  it("keeps the local derivative after upload so a slow network does not reload the tile", () => {
    const preview = "blob:https://reswell.com/thumb"
    assert.equal(
      listingPhotoTilePreviewSrc(
        slot({
          previewUrl: preview,
          localPreviewReady: true,
          optimizePhase: "done",
          uploadPhase: "done",
          url: "https://cdn.example/full.webp",
          thumbnailUrl: "https://cdn.example/thumb.webp",
        }),
      ),
      preview,
    )
  })

  it("uses the stored thumbnail for photos hydrated from the server", () => {
    assert.equal(
      listingPhotoTilePreviewSrc(
        slot({
          previewUrl: "https://cdn.example/full.webp",
          optimizePhase: "done",
          uploadPhase: "done",
          url: "https://cdn.example/full.webp",
          thumbnailUrl: "https://cdn.example/thumb.webp",
        }),
      ),
      "https://cdn.example/thumb.webp",
    )
  })
})

describe("swapListingPhotoPreviewToPreparedThumb", () => {
  it("keeps the fast derivative on screen instead of swapping to the prepared thumb", () => {
    assert.equal(
      swapListingPhotoPreviewToPreparedThumb(true, "blob:https://reswell.com/fast", new Blob(["t"])),
      null,
    )
  })

  it("points the tile at the prepared thumb when the fast path did not paint", () => {
    const current = URL.createObjectURL(new Blob(["old"]))
    const result = swapListingPhotoPreviewToPreparedThumb(
      false,
      current,
      new Blob(["thumb"], { type: "image/jpeg" }),
    )
    assert.ok(result)
    assert.equal(result.localPreviewReady, true)
    assert.match(result.previewUrl, /^blob:/)
    assert.notEqual(result.previewUrl, current)
    URL.revokeObjectURL(result.previewUrl)
  })
})

describe("listingPhotoTileSkeletonVisible", () => {
  it("shows a skeleton only until the derivative has decoded", () => {
    const image = slot({
      previewUrl: "blob:https://reswell.com/thumb",
      localPreviewReady: true,
      uploadPhase: "uploading",
      optimizePhase: "done",
    })
    assert.equal(listingPhotoTileSkeletonVisible(image, false), true)
    assert.equal(listingPhotoTileSkeletonVisible(image, true), false)
  })

  it("does not cover a failure with the skeleton", () => {
    assert.equal(
      listingPhotoTileSkeletonVisible(
        slot({ optimizePhase: "error", uploadPhase: "idle" }),
        false,
      ),
      false,
    )
  })
})
