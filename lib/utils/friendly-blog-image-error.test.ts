import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { friendlyBlogImageErrorMessage } from "./friendly-blog-image-error.ts"

describe("friendlyBlogImageErrorMessage", () => {
  it("maps auth-lock abort text to a retryable CMS message", () => {
    assert.equal(
      friendlyBlogImageErrorMessage(new Error("signal is aborted without reason")),
      "Upload was interrupted. Try again.",
    )
    assert.equal(
      friendlyBlogImageErrorMessage("The operation was aborted."),
      "Upload was interrupted. Try again.",
    )
  })

  it("keeps size and format copy", () => {
    assert.equal(
      friendlyBlogImageErrorMessage(new Error("Image must be under 8MB.")),
      "Image must be under 8MB.",
    )
    assert.equal(
      friendlyBlogImageErrorMessage(new Error("Choose an image file (JPEG, PNG, WebP, or GIF).")),
      "Choose an image file (JPEG, PNG, WebP, or GIF).",
    )
  })

  it("hides raw storage status codes", () => {
    assert.equal(
      friendlyBlogImageErrorMessage(new Error("Upload failed (500)")),
      "This image didn't upload. Try again.",
    )
  })
})
