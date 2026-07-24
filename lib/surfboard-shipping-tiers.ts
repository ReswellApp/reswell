/**
 * Standard Reswell shipping tiers for surfboards.
 *
 * Each tier is a **maximum shipping ceiling** (L×W×H + weight). Sellers pick one of three
 * options on `/sell`. Checkout quotes and labels always use the tier max — smaller packed
 * boards are fine; nothing may exceed the selected ceiling.
 *
 * **DIM** = Box Length + 2×Width + 2×Height ({@link surfboardShippingDimIn}).
 * Shortboard stays within UPS parcel limits; midlength/longboard use freight-style tiers.
 */

import {
  maxBoardWidthInchesFromInput,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  applyReswellShippingAxisBuffer,
} from "@/lib/surfboard-shipping-estimates"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import { boardCategoryMap } from "@/lib/utils/board-type-from-category-id"
import {
  maxSurfboardPackedLengthInAtDimLimit,
  SURFBOARD_LABEL_MAX_WEIGHT_LB,
  SURFBOARD_SHIPPING_DIM_FORMULA,
  surfboardShippingDimIn,
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
} from "@/lib/shipping/surfboard-label-limits"

export type SurfboardShippingTierId = "shortboard" | "midlength" | "longboard"

export const SURFBOARD_SHIPPING_TIER_IDS: SurfboardShippingTierId[] = [
  "shortboard",
  "midlength",
  "longboard",
]

export function isSurfboardShippingTierId(value: string): value is SurfboardShippingTierId {
  return SURFBOARD_SHIPPING_TIER_IDS.includes(value as SurfboardShippingTierId)
}

export function parseSurfboardShippingTierId(value: unknown): SurfboardShippingTierId | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim() as SurfboardShippingTierId
  return isSurfboardShippingTierId(trimmed) ? trimmed : null
}

/** Shortboard ships UPS/FedEx parcel; midlength and longboard use freight (e.g. Daylight). */
export function surfboardShippingTierUsesUpsParcelLimits(tierId: SurfboardShippingTierId): boolean {
  return tierId === "shortboard"
}

export function surfboardShippingTierCarrierDescription(tierId: SurfboardShippingTierId): string {
  if (tierId === "shortboard") {
    return "Ships via UPS or FedEx parcel service."
  }
  return "Ships via freight partner (e.g. Daylight Home Delivery) — not subject to UPS parcel size limits."
}

export type SurfboardShippingTier = {
  id: SurfboardShippingTierId
  label: string
  /** Seller-facing ceiling summary (max carton + how it ships). */
  summary: string
  /**
   * Inclusive lower bound on bare board length (inches) for autofill suggestions.
   * Sellers may still pick a larger tier for a shorter board (safer).
   */
  minBoardLengthIn: number
  /** Exclusive upper bound on bare board length; null = no cap */
  maxBoardLengthIn: number | null
  /** Max outer-carton width and height (inches) for this tier ceiling */
  widthIn: number
  heightIn: number
  /** Max billable weight quoted/labeled for this tier */
  weightLb: number
  /**
   * Max carrier DIM (Box Length + 2×Width + 2×Height) for this tier.
   * Null uses the Reswell UPS cap ({@link SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}).
   */
  maxDimIn: number | null
  /** Max packed box length (inches) for this tier — cap on the Length axis only. */
  maxBoxLengthIn: number | null
  /** Max billable weight for this tier; null uses {@link SURFBOARD_LABEL_MAX_WEIGHT_LB}. */
  maxWeightLb: number | null
}

/**
 * Shortboard packed ceiling — sized for real peer boxes (~23–27″ wide), not a skinny 20″ carton.
 * 78 × 27 × 7 → DIM 146″ (under Reswell UPS parcel cap of 160″).
 */
export const SURFBOARD_TIER_SHORTBOARD_MAX_BOX_LENGTH_IN = 78
export const SURFBOARD_TIER_SHORTBOARD_PROFILE_WIDTH_IN = 27
export const SURFBOARD_TIER_SHORTBOARD_PROFILE_HEIGHT_IN = 7
export const SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN = surfboardShippingDimIn(
  SURFBOARD_TIER_SHORTBOARD_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_SHORTBOARD_PROFILE_WIDTH_IN,
  SURFBOARD_TIER_SHORTBOARD_PROFILE_HEIGHT_IN,
)

/** Bare boards under 6′7″ — longest board that fits the 78″ shortboard box. */
export const SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN = 79

/** Midlength tier: max packed box length (inches) */
export const SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN = 100

/** Midlength carton — at least as wide as shortboard; longer for mid boards. */
export const SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN = 28
export const SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN = 8

/**
 * Midlength tier max DIM at the full profile (100″ box + 28×8 W×H):
 * 100 + 2(28) + 2(8) = 172″ (freight — not UPS parcel).
 */
export const SURFBOARD_TIER_MIDLENGTH_MAX_DIM_IN = surfboardShippingDimIn(
  SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN,
  SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN,
)

/** Bare boards under 8′5″ (midlength band starts at 6′7″) */
export const SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN = 101

/** Longboard tier: max packed box length (inches) */
export const SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN = 120

/** Longboard carton — real log boxes are wide; freight handles the DIM. */
export const SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN = 28
export const SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN = 8

/**
 * Longboard tier max DIM at the full profile (120″ box + 28×8 W×H):
 * 120 + 2(28) + 2(8) = 192″ (freight).
 */
export const SURFBOARD_TIER_LONGBOARD_MAX_DIM_IN = surfboardShippingDimIn(
  SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN,
  SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN,
)

/** Bare boards 8′5″ and up; exclusive upper 121″ (10′1″) fits the 120″ box cap. */
export const SURFBOARD_TIER_LONGBOARD_MAX_BOARD_LENGTH_IN = 121

export type SurfboardShippingTierDimProfile = {
  tierId: SurfboardShippingTierId
  label: string
  widthIn: number
  heightIn: number
  weightLb: number
  maxDimIn: number
  maxBoxLengthIn: number | null
  /** DIM at the tier's maximum packed box (L + 2W + 2H). */
  dimAtMaxBoxIn: number
}

export const SURFBOARD_SHIPPING_TIERS: Record<SurfboardShippingTierId, SurfboardShippingTier> = {
  shortboard: {
    id: "shortboard",
    label: "Shortboard",
    summary: "Max 78 × 27 × 7 in · 22 lb · UPS/FedEx parcel",
    minBoardLengthIn: 0,
    maxBoardLengthIn: SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN,
    widthIn: SURFBOARD_TIER_SHORTBOARD_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_SHORTBOARD_PROFILE_HEIGHT_IN,
    weightLb: 22,
    maxDimIn: SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN,
    maxBoxLengthIn: SURFBOARD_TIER_SHORTBOARD_MAX_BOX_LENGTH_IN,
    maxWeightLb: 22,
  },
  midlength: {
    id: "midlength",
    label: "Midlength",
    summary: "Max 100 × 28 × 8 in · 30 lb — freight",
    // 0: shorter boards may pick midlength when their pack needs a larger ceiling.
    minBoardLengthIn: 0,
    maxBoardLengthIn: SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN,
    widthIn: SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN,
    weightLb: 30,
    maxDimIn: SURFBOARD_TIER_MIDLENGTH_MAX_DIM_IN,
    maxBoxLengthIn: SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN,
    maxWeightLb: 30,
  },
  longboard: {
    id: "longboard",
    label: "Longboard",
    summary: "Max 120 × 28 × 8 in · 40 lb — freight",
    // 0: shorter boards may pick longboard when their pack needs a larger ceiling.
    minBoardLengthIn: 0,
    maxBoardLengthIn: SURFBOARD_TIER_LONGBOARD_MAX_BOARD_LENGTH_IN,
    widthIn: SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN,
    weightLb: 40,
    maxDimIn: SURFBOARD_TIER_LONGBOARD_MAX_DIM_IN,
    maxBoxLengthIn: SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN,
    maxWeightLb: 40,
  },
}

/** Sell-flow category keys mapped to a tier when board length is not yet available. */
const CATEGORY_KEY_TO_TIER: Record<SurfboardSellCategoryKey, SurfboardShippingTierId> = {
  shortboard: "shortboard",
  groveler: "shortboard",
  fish: "shortboard",
  asym: "shortboard",
  "step-up-gun": "shortboard",
  hybrid: "midlength",
  longboard: "longboard",
  other: "midlength",
}

export type SurfboardReswellPackageFormFields = {
  reswellPackageLengthIn?: string
  reswellPackageWidthIn?: string
  reswellPackageHeightIn?: string
  reswellPackageWeightLb?: string
  reswellPackageWeightOz?: string
}

function isBlank(value: string | undefined): boolean {
  return !value?.trim()
}

/** Max packed length (in) for a tier at its DIM and/or box-length caps. */
export function maxSurfboardTierPackedLengthIn(tier: SurfboardShippingTier): number {
  const dimCap = maxSurfboardPackedLengthInAtDimLimit(
    tier.widthIn,
    tier.heightIn,
    tier.maxDimIn ?? SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  )
  if (tier.maxBoxLengthIn != null) {
    return Math.min(dimCap, tier.maxBoxLengthIn)
  }
  return dimCap
}

export function surfboardTierMaxDimIn(tier: SurfboardShippingTier): number {
  return tier.maxDimIn ?? SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
}

export function surfboardTierMaxWeightLb(tier: SurfboardShippingTier): number {
  return tier.maxWeightLb ?? SURFBOARD_LABEL_MAX_WEIGHT_LB
}

/** DIM for a tier carton at a given packed box length. */
export function surfboardTierDimInForBoxLength(
  tier: SurfboardShippingTier,
  boxLengthIn: number,
): number {
  return surfboardShippingDimIn(boxLengthIn, tier.widthIn, tier.heightIn)
}

/** Fixed packed box length (in) for a tier — max L at that tier's DIM/box caps. */
export function surfboardShippingTierFixedLengthIn(tierId: SurfboardShippingTierId): number {
  return maxSurfboardTierPackedLengthIn(getSurfboardShippingTier(tierId))
}

/** Canonical fixed L×W×H + weight for a seller-selected tier. */
export function surfboardShippingTierFixedParcel(tierId: SurfboardShippingTierId): {
  tierId: SurfboardShippingTierId
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
} {
  const tier = getSurfboardShippingTier(tierId)
  return {
    tierId,
    lengthIn: surfboardShippingTierFixedLengthIn(tierId),
    widthIn: tier.widthIn,
    heightIn: tier.heightIn,
    weightLb: tier.weightLb,
  }
}

export function surfboardShippingTierFixedDimIn(tierId: SurfboardShippingTierId): number {
  const packed = surfboardShippingTierFixedParcel(tierId)
  return surfboardShippingDimIn(packed.lengthIn, packed.widthIn, packed.heightIn)
}

/** DIM at the tier's maximum packed box length. */
export function surfboardTierDimAtMaxBoxIn(tier: SurfboardShippingTier): number {
  return surfboardTierDimInForBoxLength(tier, maxSurfboardTierPackedLengthIn(tier))
}

/** Full DIM profile for a tier (limits + carton W×H + weight). */
export function getSurfboardShippingTierDimProfile(
  tierId: SurfboardShippingTierId,
): SurfboardShippingTierDimProfile {
  const tier = getSurfboardShippingTier(tierId)
  return {
    tierId,
    label: tier.label,
    widthIn: tier.widthIn,
    heightIn: tier.heightIn,
    weightLb: tier.weightLb,
    maxDimIn: surfboardTierMaxDimIn(tier),
    maxBoxLengthIn: tier.maxBoxLengthIn,
    dimAtMaxBoxIn: surfboardTierDimAtMaxBoxIn(tier),
  }
}

/** Format bare board inches as a seller-facing length like `6′6″`. */
export function formatSurfboardTierBoardLengthLabel(totalInches: number): string {
  const whole = Math.floor(totalInches)
  const ft = Math.floor(whole / 12)
  const inchRem = whole % 12
  return `${ft}′${inchRem}″`
}

/** Inclusive max bare board length label for a tier (derived from exclusive `maxBoardLengthIn`). */
export function surfboardShippingTierMaxBoardLengthLabel(
  tierId: SurfboardShippingTierId,
): string | null {
  const tier = getSurfboardShippingTier(tierId)
  if (tier.maxBoardLengthIn == null) return null
  return formatSurfboardTierBoardLengthLabel(tier.maxBoardLengthIn - 1)
}

/** Seller-facing board-length band for the tier ceiling picker. */
export function surfboardShippingTierBoardBandDescription(
  tierId: SurfboardShippingTierId,
): string {
  const maxLabel = surfboardShippingTierMaxBoardLengthLabel(tierId)
  if (tierId === "shortboard") {
    return maxLabel ? `Boards up to ${maxLabel}` : "Shorter boards"
  }
  if (tierId === "midlength") {
    const minLabel = formatSurfboardTierBoardLengthLabel(
      SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN,
    )
    return maxLabel ? `About ${minLabel}–${maxLabel}` : `About ${minLabel} and up`
  }
  const minLabel = formatSurfboardTierBoardLengthLabel(
    SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN,
  )
  return maxLabel ? `About ${minLabel}–${maxLabel}` : `About ${minLabel} and up`
}

/**
 * True when bare board length is within the tier's max ceiling.
 * Shorter boards may always use a larger tier.
 */
export function surfboardShippingTierAllowsBoardLength(
  boardLength: string,
  tierId: SurfboardShippingTierId,
): boolean {
  return surfboardShippingTierBoardLengthError(boardLength, tierId) == null
}

/** When set, bare board length must stay below {@link SurfboardShippingTier.maxBoardLengthIn}. */
export function surfboardShippingTierBoardLengthError(
  boardLength: string,
  tierId: SurfboardShippingTierId,
): string | null {
  const totalIn = totalBoardLengthInchesFromCombinedInput(boardLength)
  if (totalIn == null) return null

  const tier = getSurfboardShippingTier(tierId)
  if (tier.maxBoardLengthIn == null || totalIn < tier.maxBoardLengthIn) {
    return null
  }

  const maxLabel = surfboardShippingTierMaxBoardLengthLabel(tierId)
  const larger =
    tierId === "shortboard"
      ? "midlength or longboard"
      : tierId === "midlength"
        ? "longboard"
        : null

  if (larger) {
    return `This board exceeds the ${tier.label.toLowerCase()} shipping ceiling${
      maxLabel ? ` (${maxLabel} max)` : ""
    }. Choose ${larger}, or use local pickup.`
  }

  return `This board exceeds the ${tier.label.toLowerCase()} shipping ceiling${
    maxLabel ? ` (${maxLabel} max)` : ""
  }. Use local pickup or contact support for oversized boards.`
}

export function validateSurfboardShippingTierParcelLimits(
  tierId: SurfboardShippingTierId,
  parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number },
): { ok: true } | { ok: false; error: string } {
  const tier = getSurfboardShippingTier(tierId)
  const dimTotal = surfboardShippingDimIn(parcel.lengthIn, parcel.widthIn, parcel.heightIn)

  if (tier.maxBoxLengthIn != null && parcel.lengthIn > tier.maxBoxLengthIn) {
    return {
      ok: false,
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping limit (${tier.maxBoxLengthIn}″ max box length). Choose a larger shipping size or local pickup instead.`,
    }
  }

  if (tier.maxDimIn != null && dimTotal > tier.maxDimIn) {
    return {
      ok: false,
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping limit (${tier.maxDimIn}″ max ${SURFBOARD_SHIPPING_DIM_FORMULA}). Choose a larger shipping size or local pickup instead.`,
    }
  }

  if (
    tier.id === "shortboard" &&
    dimTotal > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
  ) {
    return {
      ok: false,
      error: `This board exceeds UPS shipping limits (${SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″ max ${SURFBOARD_SHIPPING_DIM_FORMULA}). Choose local pickup instead.`,
    }
  }

  const maxWeight = surfboardTierMaxWeightLb(tier)
  if (parcel.weightLb > maxWeight) {
    return {
      ok: false,
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping weight limit (${maxWeight} lb max). Choose a larger shipping size or local pickup instead.`,
    }
  }

  return { ok: true }
}

export function getSurfboardShippingTier(id: SurfboardShippingTierId): SurfboardShippingTier {
  return SURFBOARD_SHIPPING_TIERS[id]
}

/**
 * Bare board width at/above this usually won't pack into the 27″ shortboard box
 * (leave ~2″ for padding), so we suggest Midlength even when length still fits Shortboard.
 */
export const SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_WIDTH_IN = 25

export function resolveSurfboardShippingTierFromBoardLengthIn(
  totalLengthIn: number,
): SurfboardShippingTierId {
  if (!Number.isFinite(totalLengthIn) || totalLengthIn <= 0) {
    return "midlength"
  }
  if (totalLengthIn < SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN) {
    return "shortboard"
  }
  if (totalLengthIn < SURFBOARD_TIER_MIDLENGTH_MAX_BOARD_LENGTH_IN) {
    return "midlength"
  }
  return "longboard"
}

export function resolveSurfboardShippingTierFromBoardLength(
  boardLength: string,
): SurfboardShippingTierId | null {
  const totalIn = totalBoardLengthInchesFromCombinedInput(boardLength)
  if (totalIn == null) return null
  return resolveSurfboardShippingTierFromBoardLengthIn(totalIn)
}

export type SurfboardShippingTierSuggestReason =
  | "length"
  | "wide-board"
  | "category"
  | "fallback"

/**
 * Suggest a shipping ceiling from board specs (length first, then width bump).
 * Extra-wide boards (≥25″ bare) bump Shortboard → Midlength so checkout rates stay safe.
 * Normal shortboards around 20–22″ wide stay on Shortboard (27″ box ceiling).
 */
export function resolveSurfboardShippingTierFromBoardSpecs(input: {
  boardLength?: string
  boardWidthInches?: string
  category?: string
}): { tierId: SurfboardShippingTierId; reason: SurfboardShippingTierSuggestReason } | null {
  const fromLength = input.boardLength?.trim()
    ? resolveSurfboardShippingTierFromBoardLength(input.boardLength)
    : null

  if (fromLength) {
    const widthIn = input.boardWidthInches?.trim()
      ? maxBoardWidthInchesFromInput(input.boardWidthInches)
      : null
    if (
      fromLength === "shortboard" &&
      widthIn != null &&
      widthIn >= SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_WIDTH_IN
    ) {
      return { tierId: "midlength", reason: "wide-board" }
    }
    return { tierId: fromLength, reason: "length" }
  }

  const category = input.category?.trim()
  if (category) {
    const fromCategory = resolveSurfboardShippingTierFromCategoryId(category)
    if (fromCategory) return { tierId: fromCategory, reason: "category" }
  }

  return null
}

/** Next larger ceiling, if any (for “need more room” UI). */
export function surfboardShippingTierNextLarger(
  tierId: SurfboardShippingTierId,
): SurfboardShippingTierId | null {
  if (tierId === "shortboard") return "midlength"
  if (tierId === "midlength") return "longboard"
  return null
}

/** Plain-language fit line — no DIM jargon. */
export function surfboardShippingTierEasyFitLine(tierId: SurfboardShippingTierId): string {
  const packed = surfboardShippingTierFixedParcel(tierId)
  return `Maximum packed size: ${packed.lengthIn} × ${packed.widthIn} × ${packed.heightIn} in · ${packed.weightLb} lb. Smaller is fine — do not go over.`
}

/** One-line “why this tier” for sellers. */
export function surfboardShippingTierEasyWhy(tierId: SurfboardShippingTierId): string {
  if (tierId === "shortboard") {
    return "Usually the lowest shipping cost — UPS or FedEx parcel"
  }
  if (tierId === "midlength") {
    return "For longer or wider packed boards — ships by freight"
  }
  return "For the biggest boards and packs — ships by freight"
}

/**
 * Packed outer length for a bare board: floored to whole inches, capped at the UPS max for the tier W×H.
 */
export function surfboardTierPackedLengthInFromBoardLengthIn(
  totalLengthIn: number,
): number {
  const tierId = resolveSurfboardShippingTierFromBoardLengthIn(totalLengthIn)
  return surfboardTierPackedLengthInForTier(tierId, totalLengthIn)
}

/** Packed outer length for a bare board within a seller-selected tier. */
export function surfboardTierPackedLengthInForTier(
  tierId: SurfboardShippingTierId,
  totalLengthIn: number,
): number {
  const tier = getSurfboardShippingTier(tierId)
  const packedLength = applyReswellShippingAxisBuffer(totalLengthIn)
  const tierMaxL = maxSurfboardTierPackedLengthIn(tier)
  return Math.min(packedLength, tierMaxL)
}

export function surfboardShippingTierPackedParcelFromSelection(
  tierId: SurfboardShippingTierId,
): {
  tierId: SurfboardShippingTierId
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
} {
  return surfboardShippingTierFixedParcel(tierId)
}

export function surfboardShippingTierPackedParcelFromBoardLengthIn(
  totalLengthIn: number,
): {
  tierId: SurfboardShippingTierId
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
} {
  const tierId = resolveSurfboardShippingTierFromBoardLengthIn(totalLengthIn)
  const tier = getSurfboardShippingTier(tierId)
  return {
    tierId,
    lengthIn: surfboardTierPackedLengthInFromBoardLengthIn(totalLengthIn),
    widthIn: tier.widthIn,
    heightIn: tier.heightIn,
    weightLb: tier.weightLb,
  }
}

export function resolveSurfboardShippingTierFromCategoryId(
  categoryId: string,
): SurfboardShippingTierId | null {
  const normalized = categoryId.trim().toLowerCase()
  if (!normalized) return null
  for (const [key, uuid] of Object.entries(boardCategoryMap) as [SurfboardSellCategoryKey, string][]) {
    if (uuid.trim().toLowerCase() === normalized) {
      return CATEGORY_KEY_TO_TIER[key]
    }
  }
  return null
}

export function resolveSurfboardShippingTierForSellForm(input: {
  boardLength?: string
  boardWidthInches?: string
  category?: string
}): SurfboardShippingTierId | null {
  return resolveSurfboardShippingTierFromBoardSpecs(input)?.tierId ?? null
}

export function surfboardShippingTierParcelFormFields(input: {
  tierId?: SurfboardShippingTierId
}): SurfboardReswellPackageFormFields {
  const tierId = input.tierId ?? null
  if (!tierId) {
    return {
      reswellPackageLengthIn: "",
      reswellPackageWidthIn: "",
      reswellPackageHeightIn: "",
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }
  }

  const packed = surfboardShippingTierFixedParcel(tierId)
  return {
    reswellPackageLengthIn: String(packed.lengthIn),
    reswellPackageWidthIn: String(packed.widthIn),
    reswellPackageHeightIn: String(packed.heightIn),
    reswellPackageWeightLb: String(packed.weightLb),
    reswellPackageWeightOz: "",
  }
}

export function surfboardReswellPackageDimensionsAllBlank(
  fields: SurfboardReswellPackageFormFields,
): boolean {
  return (
    isBlank(fields.reswellPackageLengthIn) &&
    isBlank(fields.reswellPackageWidthIn) &&
    isBlank(fields.reswellPackageHeightIn)
  )
}

export function surfboardReswellPackageWeightAllBlank(
  fields: SurfboardReswellPackageFormFields,
): boolean {
  return isBlank(fields.reswellPackageWeightLb) && isBlank(fields.reswellPackageWeightOz)
}

export function surfboardReswellPackageHasPartialDimensions(
  fields: SurfboardReswellPackageFormFields,
): boolean {
  const filled = [
    !isBlank(fields.reswellPackageLengthIn),
    !isBlank(fields.reswellPackageWidthIn),
    !isBlank(fields.reswellPackageHeightIn),
  ]
  return filled.some(Boolean) && !filled.every(Boolean)
}

export function applySurfboardShippingTierDefaults<
  T extends SurfboardReswellPackageFormFields & {
    surfboardShippingTier?: string
  },
>(fields: T, input?: { tierId?: SurfboardShippingTierId }): T {
  const tierId =
    input?.tierId ?? parseSurfboardShippingTierId(fields.surfboardShippingTier)
  if (!tierId) return fields

  const tierFields = surfboardShippingTierParcelFormFields({ tierId })
  const dimsBlank = surfboardReswellPackageDimensionsAllBlank(fields)
  const weightBlank = surfboardReswellPackageWeightAllBlank(fields)

  if (!dimsBlank && !surfboardReswellPackageHasPartialDimensions(fields) && !weightBlank) {
    return fields
  }

  return {
    ...fields,
    reswellPackageLengthIn: isBlank(fields.reswellPackageLengthIn)
      ? tierFields.reswellPackageLengthIn
      : fields.reswellPackageLengthIn,
    reswellPackageWidthIn: isBlank(fields.reswellPackageWidthIn)
      ? tierFields.reswellPackageWidthIn
      : fields.reswellPackageWidthIn,
    reswellPackageHeightIn: isBlank(fields.reswellPackageHeightIn)
      ? tierFields.reswellPackageHeightIn
      : fields.reswellPackageHeightIn,
    reswellPackageWeightLb: weightBlank
      ? tierFields.reswellPackageWeightLb
      : fields.reswellPackageWeightLb,
    reswellPackageWeightOz: weightBlank
      ? tierFields.reswellPackageWeightOz
      : fields.reswellPackageWeightOz,
  }
}

export function surfboardShippingTierAutofillFromBoardLength(
  boardLength: string,
): (SurfboardReswellPackageFormFields & { tierId: SurfboardShippingTierId }) | null {
  const totalIn = totalBoardLengthInchesFromCombinedInput(boardLength)
  if (totalIn == null) return null
  const packed = surfboardShippingTierPackedParcelFromBoardLengthIn(totalIn)
  return surfboardShippingTierAutofillFromSelection(packed.tierId)
}

/** Autofill packed parcel fields from a seller-selected tier. */
export function surfboardShippingTierAutofillFromSelection(
  tierId: SurfboardShippingTierId,
): SurfboardReswellPackageFormFields & { tierId: SurfboardShippingTierId } {
  const packed = surfboardShippingTierFixedParcel(tierId)
  return {
    tierId,
    reswellPackageLengthIn: String(packed.lengthIn),
    reswellPackageWidthIn: String(packed.widthIn),
    reswellPackageHeightIn: String(packed.heightIn),
    reswellPackageWeightLb: String(packed.weightLb),
    reswellPackageWeightOz: "",
  }
}

export function surfboardShippingTierDimInFromSelection(
  tierId: SurfboardShippingTierId,
): number {
  return surfboardShippingTierFixedDimIn(tierId)
}

export function surfboardShippingTierDimInFromBoardLength(boardLength: string): number | null {
  const totalIn = totalBoardLengthInchesFromCombinedInput(boardLength)
  if (totalIn == null) return null
  const packed = surfboardShippingTierPackedParcelFromBoardLengthIn(totalIn)
  return surfboardShippingDimIn(packed.lengthIn, packed.widthIn, packed.heightIn)
}

export function surfboardShippingTierHeadline(tierId: SurfboardShippingTierId): string {
  const tier = getSurfboardShippingTier(tierId)
  const band = surfboardShippingTierBoardBandDescription(tierId)
  return `${band} · up to ${tier.weightLb} lb`
}

/** One-line ceiling reminder shown under the selected tier. */
export function surfboardShippingTierCeilingReminder(tierId: SurfboardShippingTierId): string {
  const packed = surfboardShippingTierFixedParcel(tierId)
  return `Quotes and labels use this max size (${packed.lengthIn} × ${packed.widthIn} × ${packed.heightIn} in, ${packed.weightLb} lb). Your packed board must fit inside — smaller is fine.`
}

/** Seller-facing limit line for the tier card (DIM vs box length). */
export function surfboardShippingTierLimitDescription(tier: SurfboardShippingTier): string {
  if (tier.maxDimIn != null && tier.maxBoxLengthIn != null) {
    return `${tier.maxDimIn}″ max DIM (${tier.maxBoxLengthIn}″ max box)`
  }
  if (tier.maxDimIn != null) {
    return `${tier.maxDimIn}″ max DIM`
  }
  if (tier.maxBoxLengthIn != null) {
    return `${tier.maxBoxLengthIn}″ max box length`
  }
  return `${surfboardTierMaxDimIn(tier)}″ max DIM`
}

export function surfboardShippingTierSummaryLine(tierId: SurfboardShippingTierId): string {
  const packed = surfboardShippingTierFixedParcel(tierId)
  return `${packed.weightLb} lb — ${packed.lengthIn} × ${packed.widthIn} × ${packed.heightIn} in`
}

/** Representative bare lengths for docs / estimator presets (inches). */
export const SURFBOARD_TIER_EXAMPLE_BOARD_LENGTH_IN: Record<SurfboardShippingTierId, number> = {
  shortboard: 74,
  midlength: 96,
  longboard: 114,
}

export function assertSurfboardShippingTiersWithinCarrierLimits(): void {
  for (const tier of Object.values(SURFBOARD_SHIPPING_TIERS)) {
    const packed = surfboardShippingTierFixedParcel(tier.id)
    const check = validateSurfboardShippingTierParcelLimits(tier.id, {
      lengthIn: packed.lengthIn,
      widthIn: packed.widthIn,
      heightIn: packed.heightIn,
      weightLb: packed.weightLb,
    })
    if (!check.ok) {
      throw new Error(`Surfboard shipping tier "${tier.id}" exceeds limits: ${check.error}`)
    }
  }

  const shortPacked = surfboardShippingTierFixedParcel("shortboard")
  const shortDim = surfboardShippingDimIn(
    shortPacked.lengthIn,
    shortPacked.widthIn,
    shortPacked.heightIn,
  )
  if (shortDim !== SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN) {
    throw new Error(
      `Shortboard tier fixed box should produce ${SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN}" DIM, got ${shortDim}"`,
    )
  }

  const midPacked = surfboardShippingTierFixedParcel("midlength")
  if (midPacked.lengthIn !== SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN) {
    throw new Error(
      `Midlength tier fixed box should be ${SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN}" long, got ${midPacked.lengthIn}"`,
    )
  }
  if (midPacked.weightLb !== 30) {
    throw new Error(`Midlength tier weight should be 30 lb, got ${midPacked.weightLb}`)
  }
  const midDim = surfboardShippingDimIn(
    midPacked.lengthIn,
    midPacked.widthIn,
    midPacked.heightIn,
  )
  if (midDim !== SURFBOARD_TIER_MIDLENGTH_MAX_DIM_IN) {
    throw new Error(
      `Midlength tier fixed box should produce ${SURFBOARD_TIER_MIDLENGTH_MAX_DIM_IN}" DIM, got ${midDim}"`,
    )
  }

  const longPacked = surfboardShippingTierFixedParcel("longboard")
  if (longPacked.lengthIn !== SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN) {
    throw new Error(
      `Longboard tier fixed box should be ${SURFBOARD_TIER_LONGBOARD_MAX_BOX_LENGTH_IN}" long, got ${longPacked.lengthIn}"`,
    )
  }
  if (longPacked.weightLb !== 40) {
    throw new Error(`Longboard tier weight should be 40 lb, got ${longPacked.weightLb}`)
  }
  const longDim = surfboardShippingDimIn(
    longPacked.lengthIn,
    longPacked.widthIn,
    longPacked.heightIn,
  )
  if (longDim !== SURFBOARD_TIER_LONGBOARD_MAX_DIM_IN) {
    throw new Error(
      `Longboard tier fixed box should produce ${SURFBOARD_TIER_LONGBOARD_MAX_DIM_IN}" DIM, got ${longDim}"`,
    )
  }
}

assertSurfboardShippingTiersWithinCarrierLimits()

// ---------------------------------------------------------------------------
// Fallback buyer-pays ranges (sell-flow calculator)
// Prefer live /api/shipping/buyer-zone-estimate when a ship-from ZIP is available.
// ---------------------------------------------------------------------------

/** Destination bands shown in the sell-flow buyer shipping calculator. */
export type ReswellBuyerEstimateZone =
  | "california"
  | "west"
  | "rest_of_us"
  | "hawaii"

export const RESWELL_BUYER_ESTIMATE_ZONE_LABELS: Record<ReswellBuyerEstimateZone, string> = {
  california: "Within California",
  west: "West Coast / Mountain (OR, WA, CO, AZ, NV, UT…)",
  rest_of_us: "Rest of continental U.S.",
  hawaii: "Hawaii / Alaska",
}

export const RESWELL_BUYER_ESTIMATE_ZONES: ReswellBuyerEstimateZone[] = [
  "california",
  "west",
  "rest_of_us",
  "hawaii",
]

export type ReswellBuyerEstimateRangeUsd = {
  lowUsd: number
  highUsd: number
}

/**
 * Typical buyer totals (USD) by tier × destination, for the fixed tier ceiling carton.
 * Tuned as ballpark guidance — refresh when carrier pricing shifts materially.
 */
export const RESWELL_BUYER_SHIPPING_ESTIMATES_USD: Record<
  SurfboardShippingTierId,
  Record<ReswellBuyerEstimateZone, ReswellBuyerEstimateRangeUsd>
> = {
  shortboard: {
    california: { lowUsd: 45, highUsd: 75 },
    west: { lowUsd: 60, highUsd: 95 },
    rest_of_us: { lowUsd: 85, highUsd: 140 },
    hawaii: { lowUsd: 150, highUsd: 240 },
  },
  midlength: {
    california: { lowUsd: 90, highUsd: 140 },
    west: { lowUsd: 110, highUsd: 170 },
    rest_of_us: { lowUsd: 160, highUsd: 260 },
    hawaii: { lowUsd: 180, highUsd: 320 },
  },
  longboard: {
    california: { lowUsd: 130, highUsd: 200 },
    west: { lowUsd: 150, highUsd: 230 },
    rest_of_us: { lowUsd: 220, highUsd: 380 },
    hawaii: { lowUsd: 250, highUsd: 420 },
  },
}

export function getReswellBuyerShippingEstimateUsd(
  tierId: SurfboardShippingTierId,
  zone: ReswellBuyerEstimateZone,
): ReswellBuyerEstimateRangeUsd {
  return RESWELL_BUYER_SHIPPING_ESTIMATES_USD[tierId][zone]
}

export function formatReswellBuyerShippingEstimateUsd(
  range: ReswellBuyerEstimateRangeUsd,
): string {
  if (range.lowUsd === range.highUsd) return `$${range.lowUsd}`
  return `$${range.lowUsd}–$${range.highUsd}`
}

/** "From $X" using the lowest continental band for a tier. */
export function reswellBuyerShippingFromUsd(tierId: SurfboardShippingTierId): number {
  return RESWELL_BUYER_SHIPPING_ESTIMATES_USD[tierId].california.lowUsd
}
