import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  createEmptyListingVideoSlot,
  isListingVideoImagePreviewUrl,
  listingVideoUploadReady,
  listingVideoUploadStatusLabel,
} from "./listing-video-slot.ts"

describe("isListingVideoImagePreviewUrl", () => {
  it("treats local blob previews as video, not a broken img", () => {
    assert.equal(isListingVideoImagePreviewUrl("blob:https://reswell.com/abc"), false)
  })

  it("treats stored mp4/mov/webm as video", () => {
    assert.equal(
      isListingVideoImagePreviewUrl(
        "https://abc.supabase.co/storage/v1/object/public/listings/u/1-video.mp4",
      ),
      false,
    )
    assert.equal(
      isListingVideoImagePreviewUrl(
        "https://abc.supabase.co/storage/v1/object/public/listings/u/1-video.mov?v=1",
      ),
      false,
    )
  })

  it("treats poster webp/jpeg as images", () => {
    assert.equal(
      isListingVideoImagePreviewUrl(
        "https://abc.supabase.co/storage/v1/object/public/listings/u/1-video-poster.webp",
      ),
      true,
    )
  })
})

describe("listingVideoUploadStatusLabel", () => {
  it("shows preparing until bytes start moving", () => {
    const slot = createEmptyListingVideoSlot({ status: "uploading", uploadProgress: 0.05 })
    assert.equal(listingVideoUploadStatusLabel(slot), "Preparing…")
  })

  it("shows a percent once the file is on the wire", () => {
    const slot = createEmptyListingVideoSlot({ status: "uploading", uploadProgress: 0.5 })
    assert.equal(listingVideoUploadStatusLabel(slot), "Uploading 50%")
  })
})

describe("listingVideoUploadReady", () => {
  it("is ready only with a finished public URL", () => {
    assert.equal(listingVideoUploadReady(null), true)
    assert.equal(
      listingVideoUploadReady(createEmptyListingVideoSlot({ status: "uploading" })),
      false,
    )
    assert.equal(
      listingVideoUploadReady(
        createEmptyListingVideoSlot({ status: "ready", url: "https://cdn.example/v.mp4" }),
      ),
      true,
    )
  })
})
