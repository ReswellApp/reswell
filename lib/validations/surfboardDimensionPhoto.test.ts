import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET,
  surfboardDimensionPhotoMatchMeetsTarget,
} from "./surfboardDimensionPhoto.ts"

describe("surfboardDimensionPhotoMatchMeetsTarget", () => {
  it("requires 95% on both Photo and Dims", () => {
    assert.equal(SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET, 0.95)
    assert.equal(
      surfboardDimensionPhotoMatchMeetsTarget({
        photoAccuracy: 0.95,
        dimsAccuracy: 0.95,
      }),
      true,
    )
    assert.equal(
      surfboardDimensionPhotoMatchMeetsTarget({
        photoAccuracy: 0.94,
        dimsAccuracy: 0.99,
      }),
      false,
    )
    assert.equal(
      surfboardDimensionPhotoMatchMeetsTarget({
        photoAccuracy: 0.99,
        dimsAccuracy: 0.94,
      }),
      false,
    )
  })

  it("rejects missing ratings", () => {
    assert.equal(
      surfboardDimensionPhotoMatchMeetsTarget({
        photoAccuracy: null,
        dimsAccuracy: 0.99,
      }),
      false,
    )
    assert.equal(
      surfboardDimensionPhotoMatchMeetsTarget({
        photoAccuracy: 0.99,
        dimsAccuracy: null,
      }),
      false,
    )
  })
})
