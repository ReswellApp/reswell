import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addListingPhotoQuarterTurns,
  effectiveListingPhotoQuarterTurns,
  listingPhotoOrientationPrepareOptions,
  listingPhotoQuarterTurnsAfterAdjust,
  normalizeListingPhotoQuarterTurns,
} from "./listing-photo-orientation.ts"

describe("listing photo quarter turns", () => {
  it("wraps turns into 0–3", () => {
    assert.equal(normalizeListingPhotoQuarterTurns(undefined), 0)
    assert.equal(normalizeListingPhotoQuarterTurns(4), 0)
    assert.equal(normalizeListingPhotoQuarterTurns(-1), 3)
    assert.equal(addListingPhotoQuarterTurns(3, 1), 0)
    assert.equal(addListingPhotoQuarterTurns(0, -1), 3)
  })

  it("reads the old 180° flag until a quarter turn is stored", () => {
    assert.equal(effectiveListingPhotoQuarterTurns({ userRotate180: true }), 2)
    assert.equal(
      effectiveListingPhotoQuarterTurns({ userRotate180: true, userQuarterTurns: 1 }),
      1,
    )
  })

  it("keeps camera auto-orient on an original and skips it on a saved photo", () => {
    assert.deepEqual(listingPhotoOrientationPrepareOptions({ userQuarterTurns: 1 }), {
      skipLandscapeToPortrait: false,
      rotateClockwiseQuarterTurns: 1,
    })
    assert.deepEqual(
      listingPhotoOrientationPrepareOptions({
        userQuarterTurns: 1,
        sourceIsDerivative: true,
      }),
      {
        skipLandscapeToPortrait: true,
        rotateClockwiseQuarterTurns: 1,
      },
    )
  })

  it("accumulates on a kept original and applies only the new turn to a download", () => {
    const file = new File([new Uint8Array([1])], "photo.jpg", { type: "image/jpeg" })
    assert.deepEqual(
      listingPhotoQuarterTurnsAfterAdjust(
        { sourceFile: file, userQuarterTurns: 1 },
        1,
      ),
      { userQuarterTurns: 2, sourceIsDerivative: false },
    )
    assert.deepEqual(listingPhotoQuarterTurnsAfterAdjust({ userQuarterTurns: 1 }, 1), {
      userQuarterTurns: 1,
      sourceIsDerivative: true,
    })
  })
})
