/**
 * Standard Reswell shipping tiers for surfboards.
 *
 * Each tier is a **fixed packaging profile** (L×W×H + weight). Sellers pick one of three
 * options on `/sell`; nothing is derived from board length.
 *
 * **DIM** = Box Length + 2×Width + 2×Height ({@link surfboardShippingDimIn}).
 * Shortboard stays within UPS parcel limits; midlength/longboard use freight-style tiers.
 */

import { totalBoardLengthInchesFromCombinedInput } from "@/lib/board-measurements"
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
  /** Describes the board-length band — packed length is computed from the seller's board. */
  summary: string
  /** Inclusive lower bound on bare board length (inches) for tier selection */
  minBoardLengthIn: number
  /** Exclusive upper bound on bare board length; null = no cap */
  maxBoardLengthIn: number | null
  /** Standard outer-carton width and height (inches) for this tier */
  widthIn: number
  heightIn: number
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

/** Shortboard tier: max DIM = Box Length + 2×Width + 2×Height */
export const SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN = 130

/** Bare boards under 6′7″ — longest board that fits 130″ DIM at 20×6 W×H (78″ packed length). */
export const SURFBOARD_TIER_SHORTBOARD_MAX_BOARD_LENGTH_IN = 79

/** Midlength tier: max packed box length (inches) */
export const SURFBOARD_TIER_MIDLENGTH_MAX_BOX_LENGTH_IN = 100

/** Midlength carton width × height (inches) */
export const SURFBOARD_TIER_MIDLENGTH_PROFILE_WIDTH_IN = 22
export const SURFBOARD_TIER_MIDLENGTH_PROFILE_HEIGHT_IN = 7

/**
 * Midlength tier max DIM at the full profile (100″ box + 22×7 W×H):
 * 100 + 2(22) + 2(7) = 158″
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

/** Longboard carton width × height (inches) — 14×6 keeps full 120″ box at 160″ DIM (UPS cap). */
export const SURFBOARD_TIER_LONGBOARD_PROFILE_WIDTH_IN = 14
export const SURFBOARD_TIER_LONGBOARD_PROFILE_HEIGHT_IN = 6

/**
 * Longboard tier max DIM at the full profile (120″ box + 14×6 W×H):
 * 120 + 2(14) + 2(6) = 160″
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
    summary: "78 × 20 × 6 in carton — 130″ max DIM, UPS parcel",
    minBoardLengthIn: 0,
    maxBoardLengthIn: null,
    widthIn: 20,
    heightIn: 6,
    weightLb: 20,
    maxDimIn: SURFBOARD_TIER_SHORTBOARD_MAX_DIM_IN,
    maxBoxLengthIn: null,
    maxWeightLb: null,
  },
  midlength: {
    id: "midlength",
    label: "Midlength",
    summary: "100 × 22 × 7 in carton — 158″ max DIM, freight",
    minBoardLengthIn: 0,
    maxBoardLengthIn: null,
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
    summary: "120 × 14 × 6 in carton — 160″ max DIM, freight",
    minBoardLengthIn: 0,
    maxBoardLengthIn: null,
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

  const maxBareIn = tier.maxBoardLengthIn - 1
  const maxFt = Math.floor(maxBareIn / 12)
  const maxInRem = maxBareIn % 12
  const maxLabel =
    maxInRem === 0 ? `${maxFt}'0″` : `${maxFt}'${maxInRem}″`

  return `This board exceeds the ${tier.label.toLowerCase()} shipping limit (${maxLabel} max). Use flat-rate shipping or local pickup instead.`
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
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping limit (${tier.maxBoxLengthIn}″ max box length). Use flat-rate shipping or local pickup instead.`,
    }
  }

  if (tier.maxDimIn != null && dimTotal > tier.maxDimIn) {
    return {
      ok: false,
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping limit (${tier.maxDimIn}″ max ${SURFBOARD_SHIPPING_DIM_FORMULA}). Use flat-rate shipping or local pickup instead.`,
    }
  }

  if (
    tier.id === "shortboard" &&
    dimTotal > SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
  ) {
    return {
      ok: false,
      error: `This board exceeds UPS shipping limits (${SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN}″ max ${SURFBOARD_SHIPPING_DIM_FORMULA}). Use flat-rate shipping or local pickup instead.`,
    }
  }

  const maxWeight = surfboardTierMaxWeightLb(tier)
  if (parcel.weightLb > maxWeight) {
    return {
      ok: false,
      error: `This board exceeds the ${tier.label.toLowerCase()} shipping weight limit (${maxWeight} lb max). Use flat-rate shipping or local pickup instead.`,
    }
  }

  return { ok: true }
}

export function getSurfboardShippingTier(id: SurfboardShippingTierId): SurfboardShippingTier {
  return SURFBOARD_SHIPPING_TIERS[id]
}

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
  category?: string
}): SurfboardShippingTierId | null {
  const fromLength = input.boardLength?.trim()
    ? resolveSurfboardShippingTierFromBoardLength(input.boardLength)
    : null
  if (fromLength) return fromLength

  const category = input.category?.trim()
  if (!category) return null
  return resolveSurfboardShippingTierFromCategoryId(category)
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
  if (tier.maxDimIn != null) {
    return `${tier.label} (up to ${tier.maxDimIn}″ DIM) / ${tier.weightLb} lb`
  }
  if (tier.maxBoxLengthIn != null) {
    return `${tier.label} (up to ${tier.maxBoxLengthIn}″ box) / ${tier.weightLb} lb`
  }
  return `${tier.label} (up to ${surfboardTierMaxDimIn(tier)}″ DIM) / ${tier.weightLb} lb`
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
