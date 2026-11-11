import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import {
  SURFBOARD_SELL_CATEGORY_LABELS,
  SURFBOARD_SELL_CATEGORY_ORDER,
} from "@/lib/surfboard-sell-categories"
import {
  isBoardLengthEntryComplete,
  parseBoardMeasurement,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"

/** Exact liters per cubic inch (2.54³ / 1000). */
export const CUBIC_INCHES_TO_LITERS = 0.016_387_064

/**
 * Outline fullness relative to the selected board style.
 * Shapers vary nose/tail pull and rail foam within a category; this nudges the
 * Guild-style shape factor toward pulled-in or fuller templates.
 */
export const VOLUME_OUTLINE_FULLNESS_ORDER = ["pulled-in", "standard", "full"] as const

export type VolumeOutlineFullness = (typeof VOLUME_OUTLINE_FULLNESS_ORDER)[number]

export const VOLUME_OUTLINE_FULLNESS_LABELS: Record<VolumeOutlineFullness, string> = {
  "pulled-in": "Pulled in",
  standard: "Standard",
  full: "Full",
}

export const VOLUME_OUTLINE_FULLNESS_HINTS: Record<VolumeOutlineFullness, string> = {
  "pulled-in": "Narrower nose/tail, thinner rails — more performance.",
  standard: "Typical stock outline for this style.",
  full: "Wider nose/tail and more foam carried through the board.",
}

/** Shape-factor delta applied on top of the style base. */
export const VOLUME_OUTLINE_FULLNESS_DELTA: Record<VolumeOutlineFullness, number> = {
  "pulled-in": -0.03,
  standard: 0,
  full: 0.03,
}

/**
 * Guild-style shape factors by Reswell board outline/style.
 * Volume ≈ L×W×T×factor×0.016387 — the factor accounts for curves, rocker, and rails
 * so results land near manufacturer-listed liters (typically within ~5–10%).
 */
export const VOLUME_OUTLINE_SHAPE_FACTORS: Record<SurfboardSellCategoryKey, number> = {
  shortboard: 0.54,
  "step-up-gun": 0.52,
  fish: 0.58,
  groveler: 0.59,
  hybrid: 0.57,
  longboard: 0.66,
  asym: 0.56,
  other: 0.55,
}

export const VOLUME_OUTLINE_DESCRIPTIONS: Record<SurfboardSellCategoryKey, string> = {
  shortboard: "Pulled nose and tail with refined rails.",
  "step-up-gun": "Narrower template for hold in bigger surf.",
  fish: "Wider outline that carries foam through the middle.",
  groveler: "Full short outline for small-wave paddle power.",
  hybrid: "Between shortboard and funboard fullness.",
  longboard: "Full nose and plenty of foam end to end.",
  asym: "Asymmetric outline — treated like a mid-full shortboard.",
  other: "Generic mid outline when the style is unclear.",
}

export type SurfboardVolumeEstimateInput = {
  lengthInches: number
  widthInches: number
  thicknessInches: number
  outline: SurfboardSellCategoryKey
  fullness?: VolumeOutlineFullness
}

export type SurfboardVolumeEstimate = {
  liters: number
  /** Rounded for display (one decimal), matching brand volume labels. */
  litersDisplay: number
  /** Approximate low/high band (±5%) around the estimate. */
  rangeLiters: { low: number; high: number }
  shapeFactor: number
  baseShapeFactor: number
  cubicInchesBox: number
  cubicInchesAdjusted: number
  outline: SurfboardSellCategoryKey
  fullness: VolumeOutlineFullness
}

export type SurfboardVolumeFormParseResult =
  | { ok: true; input: SurfboardVolumeEstimateInput }
  | { ok: false; error: string }

const RANGE_BAND = 0.05
const MIN_LENGTH_IN = 48 // 4'0
const MAX_LENGTH_IN = 144 // 12'0
const MIN_WIDTH_IN = 14
const MAX_WIDTH_IN = 30
const MIN_THICKNESS_IN = 1.5
const MAX_THICKNESS_IN = 5

function roundLiters(value: number): number {
  return Math.round(value * 10) / 10
}

export function isSurfboardVolumeOutline(
  value: string,
): value is SurfboardSellCategoryKey {
  return (SURFBOARD_SELL_CATEGORY_ORDER as readonly string[]).includes(value)
}

export function isVolumeOutlineFullness(value: string): value is VolumeOutlineFullness {
  return (VOLUME_OUTLINE_FULLNESS_ORDER as readonly string[]).includes(value)
}

export function resolveShapeFactor(
  outline: SurfboardSellCategoryKey,
  fullness: VolumeOutlineFullness = "standard",
): number {
  const base = VOLUME_OUTLINE_SHAPE_FACTORS[outline]
  const adjusted = base + VOLUME_OUTLINE_FULLNESS_DELTA[fullness]
  // Keep factors inside a physically plausible Guild range; round to avoid FP drift.
  return Math.round(Math.min(0.75, Math.max(0.42, adjusted)) * 100) / 100
}

/**
 * Estimate displacement volume in liters from max L×W×T and outline style.
 * Matches the approach shapers use for DIY estimates when CAD volume is unavailable.
 */
export function estimateSurfboardVolumeLiters(
  input: SurfboardVolumeEstimateInput,
): SurfboardVolumeEstimate {
  const fullness = input.fullness ?? "standard"
  const baseShapeFactor = VOLUME_OUTLINE_SHAPE_FACTORS[input.outline]
  const shapeFactor = resolveShapeFactor(input.outline, fullness)
  const cubicInchesBox = input.lengthInches * input.widthInches * input.thicknessInches
  const cubicInchesAdjusted = cubicInchesBox * shapeFactor
  const liters = cubicInchesAdjusted * CUBIC_INCHES_TO_LITERS
  const litersDisplay = roundLiters(liters)

  return {
    liters,
    litersDisplay,
    rangeLiters: {
      low: roundLiters(liters * (1 - RANGE_BAND)),
      high: roundLiters(liters * (1 + RANGE_BAND)),
    },
    shapeFactor,
    baseShapeFactor,
    cubicInchesBox,
    cubicInchesAdjusted,
    outline: input.outline,
    fullness,
  }
}

export function parseSurfboardVolumeFormInput(raw: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  outline: string
  fullness?: string
}): SurfboardVolumeFormParseResult {
  if (!isBoardLengthEntryComplete(raw.boardLength)) {
    return { ok: false, error: "Enter a valid length (for example 6'2)." }
  }
  const lengthInches = totalBoardLengthInchesFromCombinedInput(raw.boardLength)
  if (lengthInches == null) {
    return { ok: false, error: "Enter a valid length (for example 6'2)." }
  }
  if (lengthInches < MIN_LENGTH_IN || lengthInches > MAX_LENGTH_IN) {
    return { ok: false, error: "Length should be between 4'0 and 12'0." }
  }

  const widthInches =
    parseBoardMeasurement(raw.boardWidthInches) ??
    Number.parseFloat(raw.boardWidthInches.trim())
  if (!Number.isFinite(widthInches) || widthInches <= 0) {
    return { ok: false, error: "Enter a valid width in inches (for example 19 1/4)." }
  }
  if (widthInches < MIN_WIDTH_IN || widthInches > MAX_WIDTH_IN) {
    return { ok: false, error: "Width should be between 14\" and 30\"." }
  }

  const thicknessInches =
    parseBoardMeasurement(raw.boardThicknessInches) ??
    Number.parseFloat(raw.boardThicknessInches.trim())
  if (!Number.isFinite(thicknessInches) || thicknessInches <= 0) {
    return {
      ok: false,
      error: "Enter a valid thickness in inches (for example 2 3/8).",
    }
  }
  if (thicknessInches < MIN_THICKNESS_IN || thicknessInches > MAX_THICKNESS_IN) {
    return { ok: false, error: "Thickness should be between 1.5\" and 5\"." }
  }

  if (!isSurfboardVolumeOutline(raw.outline)) {
    return { ok: false, error: "Choose a board outline." }
  }

  const fullnessRaw = (raw.fullness ?? "standard").trim() || "standard"
  if (!isVolumeOutlineFullness(fullnessRaw)) {
    return { ok: false, error: "Choose outline fullness." }
  }

  return {
    ok: true,
    input: {
      lengthInches,
      widthInches,
      thicknessInches,
      outline: raw.outline,
      fullness: fullnessRaw,
    },
  }
}

export function volumeOutlineOptions(): ReadonlyArray<{
  value: SurfboardSellCategoryKey
  label: string
  description: string
  shapeFactor: number
}> {
  return SURFBOARD_SELL_CATEGORY_ORDER.map((value) => ({
    value,
    label: SURFBOARD_SELL_CATEGORY_LABELS[value],
    description: VOLUME_OUTLINE_DESCRIPTIONS[value],
    shapeFactor: VOLUME_OUTLINE_SHAPE_FACTORS[value],
  }))
}
