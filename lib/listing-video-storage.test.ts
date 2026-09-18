import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { isRetryableListingVideoUploadError } from "./utils/listing-video-upload-retry.ts"
import { UploadStallError } from "./utils/upload-stall-watch.ts"

describe("isRetryableListingVideoUploadError", () => {
  it("retries transient HTTP and network errors", () => {
    assert.equal(isRetryableListingVideoUploadError(new Error("Network error during upload")), true)
    assert.equal(isRetryableListingVideoUploadError(new Error("Upload failed (503)")), true)
    assert.equal(isRetryableListingVideoUploadError(new Error("Upload failed (429)")), true)
  })

  it("does not retry cancel, stall, or hard timeout", () => {
    assert.equal(
      isRetryableListingVideoUploadError(new DOMException("Upload aborted", "AbortError")),
      false,
    )
    assert.equal(isRetryableListingVideoUploadError(new UploadStallError()), false)
    assert.equal(
      isRetryableListingVideoUploadError(
        new Error("Upload timed out. Check your connection and try again."),
      ),
      false,
    )
    assert.equal(isRetryableListingVideoUploadError(new Error("Sign in again to upload this video.")), false)
  })
})
