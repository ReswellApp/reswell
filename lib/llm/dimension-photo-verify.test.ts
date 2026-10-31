import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyDimensionPhotoJevReview,
  DIMENSION_PHOTO_JEV_DIMS_CRITERIA,
  DIMENSION_PHOTO_JEV_NEXT_CRITERIA,
  DIMENSION_PHOTO_JEV_PHOTO_CRITERIA,
  DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD,
  fallbackDimensionPhotoJevReview,
  parseDimensionPhotoJevDimsVerdict,
  parseDimensionPhotoJevNextAction,
  parseDimensionPhotoJevPhotoVerdict,
} from "./dimension-photo-verify.ts"

describe("dimension photo Jev verify helpers", () => {
  it("parses known verdict keys and rejects unknowns", () => {
    assert.equal(parseDimensionPhotoJevPhotoVerdict("accept"), "accept")
    assert.equal(parseDimensionPhotoJevPhotoVerdict("reject"), "reject")
    assert.equal(parseDimensionPhotoJevPhotoVerdict("typesafe-ai/jev"), null)
    assert.equal(parseDimensionPhotoJevDimsVerdict("close"), "close")
    assert.equal(parseDimensionPhotoJevDimsVerdict("okay"), null)
    assert.equal(parseDimensionPhotoJevNextAction("retry_with_examples"), "retry_with_examples")
    assert.equal(parseDimensionPhotoJevNextAction("accept"), null)
  })

  it("keeps stamp-vs-beauty and volume rules in the rubric", () => {
    assert.match(DIMENSION_PHOTO_JEV_PHOTO_CRITERIA.accept, /size stamp/i)
    assert.match(DIMENSION_PHOTO_JEV_PHOTO_CRITERIA.reject, /beauty/i)
    assert.match(DIMENSION_PHOTO_JEV_DIMS_CRITERIA.bad, /invented/i)
    assert.match(DIMENSION_PHOTO_JEV_NEXT_CRITERIA.retry_with_examples, /NOT included/i)
    assert.match(DIMENSION_PHOTO_JEV_NEXT_CRITERIA.clear_volume, /invented/i)
  })

  it("clears invented volume and downgrades confidence on distrust", () => {
    const applied = applyDimensionPhotoJevReview(
      {
        dimensionPhotoIndex: 2,
        lengthText: "6'2",
        widthText: "19 1/4",
        thicknessText: "2 1/2",
        volumeText: "32",
        confidence: "high",
        summary: "Photo 2 stamp read 6'2 x 19 1/4 x 2 1/2",
      },
      {
        source: "jev",
        photoVerdict: "accept",
        dimsVerdict: "close",
        volumeNullProbability: 0.91,
        volumeCleared: false,
        nextAction: "clear_volume",
        retriedWithExamples: false,
        reason: "test",
      },
    )

    assert.equal(applied.observation.volumeText, null)
    assert.equal(applied.review.volumeCleared, true)
    assert.ok(0.91 >= DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD)
    assert.equal(applied.observation.confidence, "medium")
  })

  it("marks confidence low when photo is rejected", () => {
    const applied = applyDimensionPhotoJevReview(
      {
        dimensionPhotoIndex: 0,
        lengthText: "6'0",
        widthText: "19",
        thicknessText: "2 3/8",
        volumeText: null,
        confidence: "high",
        summary: "Full board beauty shot",
      },
      {
        ...fallbackDimensionPhotoJevReview("test"),
        source: "jev",
        photoVerdict: "reject",
        dimsVerdict: "bad",
        nextAction: "distrust",
      },
    )
    assert.equal(applied.observation.confidence, "low")
    assert.equal(applied.observation.lengthText, "6'0")
  })
})
