import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  applyDimensionPhotoJevReview,
  DIMENSION_PHOTO_JEV_DIMS_CRITERIA,
  DIMENSION_PHOTO_JEV_NEXT_CRITERIA,
  DIMENSION_PHOTO_JEV_PHOTO_CRITERIA,
  DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD,
  dimensionPhotoMatchPassesConfidenceGate,
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

  it("clears invented volume and keeps Close rows reviewable when match_ready is high", () => {
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
        matchReadyProbability: 0.93,
        volumeCleared: false,
        nextAction: "clear_volume",
        retriedWithExamples: false,
        withheldFromReview: false,
        reason: "test",
      },
    )

    assert.equal(applied.observation.volumeText, null)
    assert.equal(applied.review.volumeCleared, true)
    assert.ok(0.91 >= DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD)
    assert.equal(applied.observation.confidence, "medium")
    assert.equal(applied.review.withheldFromReview, false)
    assert.equal(applied.observation.dimensionPhotoIndex, 2)
  })

  it("withholds rejected photo picks from review and clears dims", () => {
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
        matchReadyProbability: 0.12,
        nextAction: "distrust",
        withheldFromReview: false,
      },
    )
    assert.equal(applied.observation.confidence, "low")
    assert.equal(applied.observation.dimensionPhotoIndex, null)
    assert.equal(applied.observation.lengthText, null)
    assert.equal(applied.review.withheldFromReview, true)
  })

  it("requires ≥90% match_ready for the publish gate", () => {
    const base = {
      source: "jev" as const,
      photoVerdict: "accept" as const,
      dimsVerdict: "good" as const,
      volumeNullProbability: 0.2,
      matchReadyProbability: 0.89,
      volumeCleared: false,
      nextAction: "keep" as const,
      retriedWithExamples: false,
      withheldFromReview: false,
      reason: "gate",
    }
    assert.equal(
      dimensionPhotoMatchPassesConfidenceGate({
        confidence: "high",
        review: base,
      }),
      false,
    )
    assert.equal(
      dimensionPhotoMatchPassesConfidenceGate({
        confidence: "high",
        review: { ...base, matchReadyProbability: 0.9 },
      }),
      true,
    )
  })
})
