/**
 * Typed Jev decisions for surfboard dimension-photo matching.
 * Jev never looks at pixels — it verifies / routes after vision.
 */

import {
  SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE,
  type SurfboardDimensionPhotoJevReview,
} from "@/lib/validations/surfboardDimensionPhoto"

export const DIMENSION_PHOTO_JEV_GATEWAY_MODEL = "typesafe-ai/jev"
export { SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE }

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

export const DIMENSION_PHOTO_JEV_MATCH_READY_INSTRUCTIONS =
  "Is this photo pick + L×W×T read ready to show an admin (and later users) as a trusted match? True only when the vision summary clearly describes a stamp close-up AND length/width/thickness look printed (not invented). False when beauty/outline/logo, missing core dims, or uncertainty."

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
    matchReadyProbability: null,
    volumeCleared: false,
    nextAction: null,
    retriedWithExamples: false,
    withheldFromReview: true,
    reason,
  }
}

/**
 * Conservative publish gate used by admin review (and later production reuse).
 * Requires high vision confidence + Jev accept/good-or-close + match_ready ≥ gate.
 * When Jev is unavailable (fallback), require vision high only — still no medium/low.
 */
export function dimensionPhotoMatchPassesConfidenceGate(input: {
  confidence: "high" | "medium" | "low"
  review: DimensionPhotoJevReview
  hasCoreDims?: boolean
  gate?: number
}): boolean {
  const gate = input.gate ?? SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE
  const { confidence, review } = input
  if (confidence !== "high") return false

  if (review.source === "fallback") {
    // Cannot score match_ready without Jev — keep high-confidence vision rows reviewable.
    return input.hasCoreDims !== false
  }

  if (review.photoVerdict !== "accept") return false
  if (review.dimsVerdict !== "good" && review.dimsVerdict !== "close") return false
  if (review.nextAction === "distrust" || review.nextAction === "retry_with_examples") {
    return false
  }
  if (
    review.matchReadyProbability == null ||
    !Number.isFinite(review.matchReadyProbability) ||
    review.matchReadyProbability < gate
  ) {
    return false
  }
  return true
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
 * volume / rejected picks and adjusts confidence for the publish gate.
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

  const nextAction =
    volumeCleared && review.nextAction === "keep" ? "clear_volume" : review.nextAction

  const gatedReview: DimensionPhotoJevReview = {
    ...review,
    volumeCleared,
    nextAction,
    withheldFromReview: false,
  }

  // Gate on vision confidence before soft Close→medium ranking downgrades.
  const hasCoreDims = Boolean(
    next.lengthText && next.widthText && next.thicknessText,
  )
  const passes = dimensionPhotoMatchPassesConfidenceGate({
    confidence: observation.confidence,
    review: gatedReview,
    hasCoreDims,
  })

  if (!passes) {
    // Do not surface uncertain / rejected picks as matches. Keep a scan marker
    // (listing won't re-queue) but clear dims so nothing looks "matched".
    next = {
      ...next,
      dimensionPhotoIndex: null,
      lengthText: null,
      widthText: null,
      thicknessText: null,
      volumeText: null,
      confidence: "low",
      summary: `${observation.summary} Withheld — below ${Math.round(SURFBOARD_DIMENSION_PHOTO_MATCH_CONFIDENCE_GATE * 100)}% confidence gate.`
        .trim()
        .slice(0, 400),
    }
    gatedReview.withheldFromReview = true
    if (!gatedReview.reason.includes("withheld")) {
      const p =
        gatedReview.matchReadyProbability != null
          ? `match_ready p=${gatedReview.matchReadyProbability.toFixed(2)}`
          : "match_ready unknown"
      gatedReview.reason = [gatedReview.reason, p, "withheld"]
        .filter(Boolean)
        .join(" · ")
        .slice(0, 400)
    }
    return { observation: next, review: gatedReview }
  }

  if (review.dimsVerdict === "close" && next.confidence === "high") {
    next = { ...next, confidence: "medium" }
  }

  return {
    observation: next,
    review: gatedReview,
  }
}
