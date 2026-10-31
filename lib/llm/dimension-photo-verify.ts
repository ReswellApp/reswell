/**
 * Typed Jev decisions for surfboard dimension-photo matching.
 * Jev never looks at pixels — it verifies / routes after vision.
 */

import type { SurfboardDimensionPhotoJevReview } from "@/lib/validations/surfboardDimensionPhoto"

export const DIMENSION_PHOTO_JEV_GATEWAY_MODEL = "typesafe-ai/jev"

export const DIMENSION_PHOTO_JEV_PHOTO_VERDICTS = ["accept", "reject"] as const
export type DimensionPhotoJevPhotoVerdict =
  (typeof DIMENSION_PHOTO_JEV_PHOTO_VERDICTS)[number]

export const DIMENSION_PHOTO_JEV_DIMS_VERDICTS = ["good", "close", "bad"] as const
export type DimensionPhotoJevDimsVerdict =
  (typeof DIMENSION_PHOTO_JEV_DIMS_VERDICTS)[number]

export const DIMENSION_PHOTO_JEV_NEXT_ACTIONS = [
  "keep",
  "clear_volume",
  "retry_with_examples",
  "distrust",
] as const
export type DimensionPhotoJevNextAction =
  (typeof DIMENSION_PHOTO_JEV_NEXT_ACTIONS)[number]

export type DimensionPhotoJevReview = SurfboardDimensionPhotoJevReview

export const DIMENSION_PHOTO_JEV_PHOTO_CRITERIA = {
  accept:
    "Vision summary describes a size stamp, stringer handwriting, tail-block label, or manufacturer dimensions sticker with readable L×W×T. Photo index is set. Not a lifestyle beauty shot, full-board outline, logo-only, or distant whole-board frame.",
  reject:
    "Vision summary describes a beauty/lifestyle shot, outline silhouette, logo/brand-only, fin box, rail detail, or any frame without printed measurements — OR dimensionPhotoIndex is null while claiming readable dims — OR the summary admits no stamp was found.",
} as const

export const DIMENSION_PHOTO_JEV_DIMS_CRITERIA = {
  good:
    "Length, width, and thickness are all present and look like real surfboard stamp text (e.g. 6'2, 19 1/4, 2 1/2). Volume is either null or clearly printed liters. Nothing looks invented from outline alone.",
  close:
    "Core dims are mostly right but one field is missing, fractional inches look imprecise, or volume is the only questionable field. Worth admin Close rather than Bad.",
  bad:
    "Missing length/width/thickness, obviously invented from outline, impossible sizes, or photo was rejected so the dims cannot be trusted.",
} as const

export const DIMENSION_PHOTO_JEV_NEXT_CRITERIA = {
  keep:
    "Photo accept and dims good or close. Keep the vision result. Clear volume only if the volume boolean says so — prefer clear_volume when liters look invented.",
  clear_volume:
    "Photo and L×W×T look usable, but volume liters were likely invented (not printed on the stamp). Keep L×W×T; null volume.",
  retry_with_examples:
    "Photo pick is uncertain or likely wrong, and contrastive GOOD/BAD stamp example images were NOT included in this vision call. Retry vision once with few-shot examples. Do not pick this when examples were already included.",
  distrust:
    "Photo reject and/or dims bad, or confidence should be low for admin review. Do not retry when few-shot examples were already included.",
} as const

export const DIMENSION_PHOTO_JEV_PHOTO_INSTRUCTIONS =
  "Decide whether the vision model picked a real dimensions/size-stamp photo. Routing only — you cannot see the image."

export const DIMENSION_PHOTO_JEV_DIMS_INSTRUCTIONS =
  "Decide how trustworthy the printed L×W×T (and optional volume) read is, given the vision summary and predicted fields."

export const DIMENSION_PHOTO_JEV_VOLUME_INSTRUCTIONS =
  "Should volume be null? True when liters are not clearly printed / were likely invented. Most stamps show only L×W×T. Prefer true when volume is present but the summary does not mention liters, L, or volume."

export const DIMENSION_PHOTO_JEV_NEXT_INSTRUCTIONS =
  "Pick the next pipeline action. You are routing only. Prefer retry_with_examples only when few_shot_images_included is false and the photo pick looks wrong or uncertain."

export const DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD = 0.65

export function parseDimensionPhotoJevPhotoVerdict(
  value: unknown,
): DimensionPhotoJevPhotoVerdict | null {
  if (value === "accept" || value === "reject") return value
  return null
}

export function parseDimensionPhotoJevDimsVerdict(
  value: unknown,
): DimensionPhotoJevDimsVerdict | null {
  if (value === "good" || value === "close" || value === "bad") return value
  return null
}

export function parseDimensionPhotoJevNextAction(
  value: unknown,
): DimensionPhotoJevNextAction | null {
  if (
    value === "keep" ||
    value === "clear_volume" ||
    value === "retry_with_examples" ||
    value === "distrust"
  ) {
    return value
  }
  return null
}

export function fallbackDimensionPhotoJevReview(reason: string): DimensionPhotoJevReview {
  return {
    source: "fallback",
    photoVerdict: null,
    dimsVerdict: null,
    volumeNullProbability: null,
    volumeCleared: false,
    nextAction: null,
    retriedWithExamples: false,
    reason,
  }
}

export type DimensionPhotoJevMutableObservation = {
  dimensionPhotoIndex: number | null
  lengthText: string | null
  widthText: string | null
  thicknessText: string | null
  volumeText: string | null
  confidence: "high" | "medium" | "low"
  summary: string
}

/**
 * Apply Jev policy to a vision observation. Does not invent dims — only clears
 * volume and adjusts confidence for admin review priority.
 */
export function applyDimensionPhotoJevReview<T extends DimensionPhotoJevMutableObservation>(
  observation: T,
  review: DimensionPhotoJevReview,
): { observation: T; review: DimensionPhotoJevReview } {
  let next: T = { ...observation }
  let volumeCleared = false

  const shouldClearVolume =
    Boolean(next.volumeText) &&
    (review.nextAction === "clear_volume" ||
      (review.volumeNullProbability != null &&
        review.volumeNullProbability >= DIMENSION_PHOTO_JEV_VOLUME_NULL_THRESHOLD))

  if (shouldClearVolume) {
    next = { ...next, volumeText: null }
    volumeCleared = true
  }

  if (
    review.photoVerdict === "reject" ||
    review.nextAction === "distrust" ||
    review.dimsVerdict === "bad"
  ) {
    next = { ...next, confidence: "low" }
  } else if (review.dimsVerdict === "close" && next.confidence === "high") {
    next = { ...next, confidence: "medium" }
  }

  return {
    observation: next,
    review: {
      ...review,
      volumeCleared,
      nextAction:
        volumeCleared && review.nextAction === "keep"
          ? "clear_volume"
          : review.nextAction,
    },
  }
}
