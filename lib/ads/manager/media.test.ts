import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  googleAssetOwnedBy,
  googleImageMime,
  isMetaVideoMime,
  parseYoutubeId,
  pmaxLinkOwnedBy,
  pmaxTextLimit,
  safeMediaName,
} from "./media.ts"

describe("ads media uploads", () => {
  it("parses a youtube watch url, short url, and bare id", () => {
    assert.equal(parseYoutubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"), "dQw4w9WgXcQ")
    assert.equal(parseYoutubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
    assert.equal(parseYoutubeId("dQw4w9WgXcQ"), "dQw4w9WgXcQ")
    assert.equal(parseYoutubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ"), "dQw4w9WgXcQ")
    assert.equal(parseYoutubeId("not a video"), null)
  })

  it("keeps Performance Max uploads inside the configured Google Ads account", () => {
    const customerId = "1234567890"
    assert.equal(pmaxTextLimit("HEADLINE"), 30)
    assert.equal(pmaxTextLimit("BUSINESS_NAME"), 25)
    assert.equal(googleAssetOwnedBy(customerId, "customers/1234567890/assets/55"), true)
    assert.equal(googleAssetOwnedBy(customerId, "customers/9999999999/assets/55"), false)
    assert.equal(pmaxLinkOwnedBy(customerId, "customers/1234567890/assetGroupAssets/7~55~HEADLINE"), true)
    assert.equal(pmaxLinkOwnedBy(customerId, "customers/9999999999/assetGroupAssets/7~55~HEADLINE"), false)
  })

  it("accepts jpeg for Google image assets and rejects webp", () => {
    assert.equal(googleImageMime("image/jpeg"), "IMAGE_JPEG")
    assert.equal(googleImageMime("image/webp"), null)
  })

  it("accepts mp4 for Meta video and strips unsafe file names", () => {
    assert.equal(isMetaVideoMime("video/mp4"), true)
    assert.equal(isMetaVideoMime("image/png"), false)
    assert.equal(safeMediaName("../../board <shot>.jpg"), "board shot.jpg")
  })
})
