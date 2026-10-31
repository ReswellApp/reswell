import assert from "node:assert/strict"
import { afterEach, describe, it } from "node:test"
import {
  dimensionPhotoJevVerifyEnabled,
  shouldRetryDimensionPhotoWithExamples,
  verifyDimensionPhotoWithJev,
} from "./jev-dimension-photo-verify.ts"
import { fallbackDimensionPhotoJevReview } from "./dimension-photo-verify.ts"

const originalGateway = process.env.AI_GATEWAY_API_KEY
const originalFlag = process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED

afterEach(() => {
  if (originalGateway === undefined) delete process.env.AI_GATEWAY_API_KEY
  else process.env.AI_GATEWAY_API_KEY = originalGateway
  if (originalFlag === undefined) delete process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED
  else process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED = originalFlag
})

const baseObservation = {
  dimensionPhotoIndex: 1,
  lengthText: "5'10",
  widthText: "19 1/2",
  thicknessText: "2 7/16",
  volumeText: "28.5",
  confidence: "high" as const,
  summary: "Index 1 stringer stamp 5'10 x 19 1/2 x 2 7/16",
}

describe("Jev dimension-photo verify", () => {
  it("falls back without inventing verdicts when Gateway is off", async () => {
    delete process.env.AI_GATEWAY_API_KEY
    process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED = "false"
    assert.equal(dimensionPhotoJevVerifyEnabled(), false)

    let called = false
    const review = await verifyDimensionPhotoWithJev(
      {
        observation: baseObservation,
        photoCount: 3,
        shotLabels: ["photo_0", "photo_1", "photo_2"],
        fewShotImagesIncluded: false,
        adminMemorySnippet: "",
      },
      {
        evaluate: async () => {
          called = true
          throw new Error("should not call Jev")
        },
      },
    )

    assert.equal(called, false)
    assert.equal(review.source, "fallback")
    assert.equal(review.photoVerdict, null)
    assert.match(review.reason, /Jev verify off/)
  })

  it("uses Jev answers when evaluate succeeds", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key"
    process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED = "true"

    const review = await verifyDimensionPhotoWithJev(
      {
        observation: baseObservation,
        photoCount: 3,
        shotLabels: ["a", "b", "c"],
        fewShotImagesIncluded: false,
        adminMemorySnippet: "photo BAD · beauty shot",
      },
      {
        evaluate: async () =>
          ({
            answers: {
              photo: { type: "choice", choice: "accept" },
              dims: { type: "choice", choice: "good" },
              volume_should_be_null: { type: "boolean", probability: 0.88 },
              next_action: { type: "choice", choice: "clear_volume" },
            },
          }) as never,
      },
    )

    assert.equal(review.source, "jev")
    assert.equal(review.photoVerdict, "accept")
    assert.equal(review.dimsVerdict, "good")
    assert.equal(review.nextAction, "clear_volume")
    assert.equal(review.volumeNullProbability, 0.88)
  })

  it("does not invent verdicts when Jev throws", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key"
    process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED = "true"

    const review = await verifyDimensionPhotoWithJev(
      {
        observation: baseObservation,
        photoCount: 2,
        shotLabels: ["a", "b"],
        fewShotImagesIncluded: true,
        adminMemorySnippet: "",
      },
      {
        evaluate: async () => {
          throw new Error("jev 404")
        },
      },
    )

    assert.equal(review.source, "fallback")
    assert.match(review.reason, /jev 404/)
  })

  it("clamps retry when few-shot images were already included", async () => {
    process.env.AI_GATEWAY_API_KEY = "test-key"
    process.env.SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED = "true"

    const review = await verifyDimensionPhotoWithJev(
      {
        observation: {
          ...baseObservation,
          summary: "Looks like a beauty shot of the whole board",
          confidence: "medium",
        },
        photoCount: 4,
        shotLabels: ["0", "1", "2", "3"],
        fewShotImagesIncluded: true,
        adminMemorySnippet: "",
      },
      {
        evaluate: async () =>
          ({
            answers: {
              photo: { type: "choice", choice: "reject" },
              dims: { type: "choice", choice: "bad" },
              volume_should_be_null: { type: "boolean", probability: 0.2 },
              next_action: { type: "choice", choice: "retry_with_examples" },
            },
          }) as never,
      },
    )

    assert.equal(review.nextAction, "distrust")
    assert.equal(shouldRetryDimensionPhotoWithExamples(review), false)
  })

  it("documents the honest fallback helper", () => {
    const review = fallbackDimensionPhotoJevReview("manual")
    assert.equal(review.source, "fallback")
    assert.equal(review.photoVerdict, null)
  })
})
