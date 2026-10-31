/**
 * Jev verifies vision dimension-photo picks and dims reads.
 * It never sees images and never invents measurements.
 */

import { experimental_evaluate } from "ai"
import {
  APP_LLM_FEATURES,
  gatewayTagsForFeature,
  isAppLlmFeatureEnabled,
  resolveConfiguredModel,
} from "./app-models.ts"
import {
  applyDimensionPhotoJevReview,
  DIMENSION_PHOTO_JEV_DIMS_CRITERIA,
  DIMENSION_PHOTO_JEV_DIMS_INSTRUCTIONS,
  DIMENSION_PHOTO_JEV_GATEWAY_MODEL,
  DIMENSION_PHOTO_JEV_NEXT_CRITERIA,
  DIMENSION_PHOTO_JEV_NEXT_INSTRUCTIONS,
  DIMENSION_PHOTO_JEV_PHOTO_CRITERIA,
  DIMENSION_PHOTO_JEV_PHOTO_INSTRUCTIONS,
  DIMENSION_PHOTO_JEV_VOLUME_INSTRUCTIONS,
  DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD,
  fallbackDimensionPhotoJevReview,
  parseDimensionPhotoJevDimsVerdict,
  parseDimensionPhotoJevNextAction,
  parseDimensionPhotoJevPhotoVerdict,
  type DimensionPhotoJevMutableObservation,
  type DimensionPhotoJevReview,
} from "./dimension-photo-verify.ts"

const FEATURE = APP_LLM_FEATURES.find((row) => row.id === "surfboard_dimension_photo_jev")

const JEV_VERIFY_TIMEOUT_MS = 2_500

export type DimensionPhotoJevEvaluate = typeof experimental_evaluate

export type DimensionPhotoJevVerifyInput = {
  observation: DimensionPhotoJevMutableObservation
  photoCount: number
  shotLabels: string[]
  fewShotImagesIncluded: boolean
  /** Compact admin rating memory text (no images). */
  adminMemorySnippet: string
  retriedWithExamples?: boolean
}

export function dimensionPhotoJevVerifyEnabled(): boolean {
  if (!FEATURE) return false
  return isAppLlmFeatureEnabled(FEATURE)
}

export function dimensionPhotoJevModelId(): string {
  if (!FEATURE) return DIMENSION_PHOTO_JEV_GATEWAY_MODEL
  return resolveConfiguredModel(FEATURE)
}

function booleanProbability(answer: unknown): number | null {
  if (!answer || typeof answer !== "object") return null
  const row = answer as { probability?: unknown; value?: unknown }
  if (typeof row.probability === "number" && Number.isFinite(row.probability)) {
    return Math.min(1, Math.max(0, row.probability))
  }
  if (typeof row.value === "boolean") return row.value ? 1 : 0
  return null
}

export async function verifyDimensionPhotoWithJev(
  input: DimensionPhotoJevVerifyInput,
  deps?: {
    evaluate?: DimensionPhotoJevEvaluate
  },
): Promise<DimensionPhotoJevReview> {
  if (!dimensionPhotoJevVerifyEnabled()) {
    return fallbackDimensionPhotoJevReview(
      "Jev verify off — no Gateway auth or SURFBOARD_DIMENSION_PHOTO_JEV_ENABLED=false.",
    )
  }

  const evaluate = deps?.evaluate ?? experimental_evaluate
  const state = {
    product: "Reswell surfboard dimension-photo match",
    task: "Verify vision photo pick + L×W×T read. Do not invent measurements.",
    photo_count: input.photoCount,
    shot_labels: input.shotLabels.slice(0, 24),
    dimension_photo_index: input.observation.dimensionPhotoIndex,
    vision_summary: input.observation.summary.slice(0, 400),
    predicted_length: input.observation.lengthText,
    predicted_width: input.observation.widthText,
    predicted_thickness: input.observation.thicknessText,
    predicted_volume: input.observation.volumeText,
    vision_confidence: input.observation.confidence,
    few_shot_images_included: input.fewShotImagesIncluded,
    already_retried_with_examples: Boolean(input.retriedWithExamples),
    admin_rating_memory: input.adminMemorySnippet.trim().slice(0, 1800) || null,
  }

  try {
    const result = await evaluate({
      model: dimensionPhotoJevModelId(),
      state,
      questions: {
        photo: {
          type: "choice",
          instructions: DIMENSION_PHOTO_JEV_PHOTO_INSTRUCTIONS,
          criteria: { ...DIMENSION_PHOTO_JEV_PHOTO_CRITERIA },
        },
        dims: {
          type: "choice",
          instructions: DIMENSION_PHOTO_JEV_DIMS_INSTRUCTIONS,
          criteria: { ...DIMENSION_PHOTO_JEV_DIMS_CRITERIA },
        },
        volume_should_be_null: {
          type: "boolean",
          instructions: DIMENSION_PHOTO_JEV_VOLUME_INSTRUCTIONS,
        },
        next_action: {
          type: "choice",
          instructions: DIMENSION_PHOTO_JEV_NEXT_INSTRUCTIONS,
          criteria: { ...DIMENSION_PHOTO_JEV_NEXT_CRITERIA },
        },
      },
      abortSignal: AbortSignal.timeout(JEV_VERIFY_TIMEOUT_MS),
      providerOptions: {
        gateway: {
          tags: gatewayTagsForFeature("surfboard_dimension_photo_jev"),
        },
      },
    })

    const photoVerdict = parseDimensionPhotoJevPhotoVerdict(result.answers.photo.choice)
    const dimsVerdict = parseDimensionPhotoJevDimsVerdict(result.answers.dims.choice)
    let nextAction = parseDimensionPhotoJevNextAction(result.answers.next_action.choice)
    const volumeNullProbability = booleanProbability(result.answers.volume_should_be_null)

    // Honest guardrails: never invent scores; clamp impossible retries.
    if (
      nextAction === "retry_with_examples" &&
      (input.fewShotImagesIncluded || input.retriedWithExamples)
    ) {
      nextAction =
        photoVerdict === "reject" || dimsVerdict === "bad" ? "distrust" : "keep"
    }

    if (!photoVerdict && !dimsVerdict && !nextAction && volumeNullProbability == null) {
      return fallbackDimensionPhotoJevReview(
        "Jev returned no usable photo/dims/next answers.",
      )
    }

    return {
      source: "jev",
      photoVerdict,
      dimsVerdict,
      volumeNullProbability,
      volumeCleared: false,
      nextAction,
      retriedWithExamples: Boolean(input.retriedWithExamples),
      reason: [
        photoVerdict ? `photo ${photoVerdict}` : null,
        dimsVerdict ? `dims ${dimsVerdict}` : null,
        volumeNullProbability != null
          ? `volume_null p=${volumeNullProbability.toFixed(2)}`
          : null,
        nextAction ? `next ${nextAction}` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error"
    console.warn("[dimensionPhotoJev] evaluate failed:", message)
    return fallbackDimensionPhotoJevReview(`Jev evaluate failed (${message}).`)
  }
}

export function finalizeDimensionPhotoWithJevReview<
  T extends DimensionPhotoJevMutableObservation,
>(observation: T, review: DimensionPhotoJevReview): {
  observation: T
  review: DimensionPhotoJevReview
} {
  return applyDimensionPhotoJevReview(observation, review)
}

export function shouldRetryDimensionPhotoWithExamples(
  review: DimensionPhotoJevReview,
): boolean {
  return review.source === "jev" && review.nextAction === "retry_with_examples"
}

export function dimensionPhotoJevSuggestsVolumeNull(
  review: DimensionPhotoJevReview,
): boolean {
  return (
    review.nextAction === "clear_volume" ||
    (review.volumeNullProbability != null &&
      review.volumeNullProbability >= DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD)
  )
}
