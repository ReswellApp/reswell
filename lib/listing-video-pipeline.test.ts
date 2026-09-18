import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  assertAcceptedListingVideoFile,
  assertListingVideoOriginalSize,
  isAcceptedListingVideoFile,
  listingVideoDurationViolation,
  listingVideoExtensionForMime,
  normalizeListingVideoMimeType,
} from "./listing-video-pipeline.ts"

function fakeFile(name: string, type: string, sizeBytes = 1024): File {
  const blob = new Blob([new Uint8Array(Math.min(sizeBytes, 16))], { type })
  return new File([blob], name, { type })
}

describe("isAcceptedListingVideoFile", () => {
  it("accepts mp4, mov, and webm by mime or extension", () => {
    assert.equal(isAcceptedListingVideoFile(fakeFile("clip.mp4", "video/mp4")), true)
    assert.equal(isAcceptedListingVideoFile(fakeFile("clip.mov", "video/quicktime")), true)
    assert.equal(isAcceptedListingVideoFile(fakeFile("clip.webm", "video/webm")), true)
    assert.equal(isAcceptedListingVideoFile(fakeFile("clip.MOV", "")), true)
  })

  it("rejects images and unknown types", () => {
    assert.equal(isAcceptedListingVideoFile(fakeFile("shot.jpg", "image/jpeg")), false)
    assert.equal(isAcceptedListingVideoFile(fakeFile("clip.avi", "video/x-msvideo")), false)
  })
})

describe("assertListingVideoOriginalSize", () => {
  it("rejects files over 200MB", () => {
    const huge = fakeFile("clip.mp4", "video/mp4")
    Object.defineProperty(huge, "size", { value: 201 * 1024 * 1024 })
    assert.throws(() => assertListingVideoOriginalSize(huge), /over 200MB/)
  })
})

describe("assertAcceptedListingVideoFile", () => {
  it("throws a friendly type error", () => {
    assert.throws(
      () => assertAcceptedListingVideoFile(fakeFile("shot.png", "image/png")),
      /isn't supported/,
    )
  })
})

describe("listingVideoDurationViolation", () => {
  it("requires at least 6 seconds", () => {
    assert.match(listingVideoDurationViolation(3) ?? "", /at least 6 seconds/)
  })

  it("caps at 2 minutes", () => {
    assert.match(listingVideoDurationViolation(181) ?? "", /up to 2 minutes/)
  })

  it("allows in-range durations", () => {
    assert.equal(listingVideoDurationViolation(6), null)
    assert.equal(listingVideoDurationViolation(120), null)
  })
})

describe("normalizeListingVideoMimeType", () => {
  it("maps mov and webm, defaulting to mp4", () => {
    assert.equal(normalizeListingVideoMimeType(fakeFile("a.mov", "video/quicktime")), "video/quicktime")
    assert.equal(normalizeListingVideoMimeType(fakeFile("a.webm", "video/webm")), "video/webm")
    assert.equal(normalizeListingVideoMimeType(fakeFile("a.mp4", "video/mp4")), "video/mp4")
    assert.equal(listingVideoExtensionForMime("video/quicktime"), "mov")
    assert.equal(listingVideoExtensionForMime("video/webm"), "webm")
    assert.equal(listingVideoExtensionForMime("video/mp4"), "mp4")
  })
})
