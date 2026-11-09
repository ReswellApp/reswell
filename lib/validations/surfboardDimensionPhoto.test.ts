import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE,
  SURFBOARD_DIMENSION_PHOTO_MATCH_TARGET,
  rateSurfboardDimensionPhotoMatchSchema,
  surfboardDimensionPhotoMatchListQuerySchema,
  surfboardDimensionPhotoMatchMeetsTarget,
} from "./surfboardDimensionPhoto.ts"

describe("surfboardDimensionPhotoMatchMeetsTarget", () => {
  it("keeps a 90% per-match publish gate separate from the 95% corpus target", () => {
    assert.equal(SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE, 0.9)
  })

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

  it("accepts withheld filter and stamp-photo corrections", () => {
    const list = surfboardDimensionPhotoMatchListQuerySchema.parse({
      rating: "withheld",
    })
    assert.equal(list.rating, "withheld")
    const rated = rateSurfboardDimensionPhotoMatchSchema.parse({
      photoRating: "bad",
      correctedSourceImageUrl: "https://cdn.example.com/stamp.jpg",
    })
    assert.equal(rated.photoRating, "bad")
    assert.equal(rated.correctedSourceImageUrl, "https://cdn.example.com/stamp.jpg")
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
