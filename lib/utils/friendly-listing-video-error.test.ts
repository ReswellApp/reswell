import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  friendlyListingVideoError,
  isListingVideoUploadCanceled,
} from "./friendly-listing-video-error.ts"
import { UploadStallError } from "./upload-stall-watch.ts"

describe("isListingVideoUploadCanceled", () => {
  it("matches AbortError only", () => {
    assert.equal(isListingVideoUploadCanceled(new DOMException("Upload aborted", "AbortError")), true)
    assert.equal(isListingVideoUploadCanceled(new Error("Network error during upload")), false)
    assert.equal(isListingVideoUploadCanceled(new Error("Failed to fetch")), false)
  })
})

describe("friendlyListingVideoError", () => {
  it("keeps stall and timeout copy actionable", () => {
    assert.equal(
      friendlyListingVideoError(new UploadStallError()),
      "Upload stalled. Check your connection and try again.",
    )
    assert.equal(
      friendlyListingVideoError(new Error("Upload timed out. Check your connection and try again.")),
      "Upload stalled. Check your connection and try again.",
    )
  })

  it("maps network failures to retry copy", () => {
    assert.equal(
      friendlyListingVideoError(new Error("Network error during upload")),
      "Upload failed. Check your connection and try again.",
    )
  })

  it("passes through size and codec messages", () => {
    assert.match(
      friendlyListingVideoError(new Error("This video is over 200MB. Choose a smaller file (yours is 240.0MB).")),
      /over 200MB/,
    )
    assert.match(
      friendlyListingVideoError(
        new Error("We couldn't read this video. Try exporting it as an MP4 (H.264), then upload again."),
      ),
      /MP4/,
    )
  })
})
