import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  boardAlertPhotoCandidateUrls,
  chooseReachableListingPhotoUrl,
  listingPhotoProbeResult,
} from "./reachable-listing-photo.ts"

const FULL = "https://proj.supabase.co/storage/v1/object/public/listings/u/1-full.webp"
const THUMB = "https://proj.supabase.co/storage/v1/object/public/listings/u/1-thumb.webp"
const VIDEO = "https://proj.supabase.co/storage/v1/object/public/listings/u/1-video.mp4"

describe("boardAlertPhotoCandidateUrls", () => {
  it("tries the full photo, then a distinct thumbnail", () => {
    assert.deepEqual(boardAlertPhotoCandidateUrls(FULL, THUMB), [FULL, THUMB])
  })

  it("skips a video and a thumbnail that is a copy of the full url", () => {
    assert.deepEqual(boardAlertPhotoCandidateUrls(VIDEO, THUMB), [THUMB])
    assert.deepEqual(boardAlertPhotoCandidateUrls(FULL, FULL), [FULL])
  })
})

describe("listingPhotoProbeResult", () => {
  it("treats Supabase NoSuchKey statuses as a missing object", () => {
    assert.equal(listingPhotoProbeResult(400), "miss")
    assert.equal(listingPhotoProbeResult(404), "miss")
  })

  it("treats a live object as a hit and a server error as unknown", () => {
    assert.equal(listingPhotoProbeResult(200), "hit")
    assert.equal(listingPhotoProbeResult(302), "hit")
    assert.equal(listingPhotoProbeResult(500), "unknown")
  })
})

describe("chooseReachableListingPhotoUrl", () => {
  it("skips a missing full photo and uses the thumbnail that exists", () => {
    assert.equal(
      chooseReachableListingPhotoUrl([
        { url: "https://www.reswell.app/media/listings/u/1-full.webp", result: "miss" },
        { url: "https://www.reswell.app/media/listings/u/1-thumb.webp", result: "hit" },
      ]),
      "https://www.reswell.app/media/listings/u/1-thumb.webp",
    )
  })

  it("sends no photo when every object is missing", () => {
    assert.equal(
      chooseReachableListingPhotoUrl([
        { url: "https://www.reswell.app/media/listings/u/1-full.webp", result: "miss" },
        { url: "https://www.reswell.app/media/listings/u/1-thumb.webp", result: "miss" },
      ]),
      null,
    )
  })

  it("keeps a photo when storage could not be checked", () => {
    assert.equal(
      chooseReachableListingPhotoUrl([
        { url: "https://www.reswell.app/media/listings/u/1-full.webp", result: "unknown" },
      ]),
      "https://www.reswell.app/media/listings/u/1-full.webp",
    )
  })
})
