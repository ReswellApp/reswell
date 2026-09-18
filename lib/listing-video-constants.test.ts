import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { listingVideoUploadTimeoutMs } from "./listing-video-constants.ts"

describe("listingVideoUploadTimeoutMs", () => {
  it("never goes below two minutes", () => {
    assert.equal(listingVideoUploadTimeoutMs(0), 120_000)
    assert.equal(listingVideoUploadTimeoutMs(1024), 120_000)
  })

  it("never exceeds fifteen minutes for a 200MB file", () => {
    assert.equal(listingVideoUploadTimeoutMs(200 * 1024 * 1024), 15 * 60_000)
  })

  it("grows with file size between the floor and ceiling", () => {
    const mid = listingVideoUploadTimeoutMs(20 * 1024 * 1024)
    assert.ok(mid > 120_000)
    assert.ok(mid < 15 * 60_000)
  })
})
