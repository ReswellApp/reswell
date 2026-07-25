/**
 * Shortboard pack bands — fixed cartons under the Shortboard family.
 *
 * Checkout quotes and labels use the selected band carton (not always Max).
 * Band ceilings were chosen to sit relative to UPS 2026 LPS / AHC volume cliffs;
 * refine via the admin shortboard rate-cliff sweep if contract rates differ.
 */

import {
  maxBoardWidthInchesFromInput,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  surfboardShippingDimIn,
} from "@/lib/shipping/surfboard-label-limits"
import { upsParcelSurchargeFlags } from "@/lib/shipping/ups-parcel-surcharge-flags"
import {
  SURFBOARD_TIER_SHORTBOARD_MAX_BOX_LENGTH_IN,
  SURFBOARD_TIER_SHORTBOARD_PROFILE_HEIGHT_IN,
  SURFBOARD_TIER_SHORTBOARD_PROFILE_WIDTH_IN,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"

export type SurfboardShippingPackBandId =
  | "shortboard_compact"
  | "shortboard_standard"
  | "shortboard_max"

export const SURFBOARD_SHIPPING_PACK_BAND_IDS: SurfboardShippingPackBandId[] = [
  "shortboard_compact",
  "shortboard_standard",
  "shortboard_max",
]

export function isSurfboardShippingPackBandId(
  value: string,
): value is SurfboardShippingPackBandId {
  return SURFBOARD_SHIPPING_PACK_BAND_IDS.includes(value as SurfboardShippingPackBandId)
}

export function parseSurfboardShippingPackBandId(
  value: unknown,
): SurfboardShippingPackBandId | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return isSurfboardShippingPackBandId(trimmed) ? trimmed : null
}

export type SurfboardShippingPackBand = {
  id: SurfboardShippingPackBandId
  label: string
  summary: string
  /** Max outer carton L×W×H + weight for quotes/labels. */
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  /**
   * Inclusive upper bare-board length (inches) this band is intended to fit
   * after a small packing pad. Sellers may still pick a larger band.
   */
  maxBoardLengthIn: number
  /** Inclusive upper bare-board width (inches) before recommending a larger band. */
  maxBoardWidthIn: number
}

/**
 * Locked shortboard pack bands (provisional → production).
 * Compact/Standard stay at or under 130″ DIM and 10,368 in³ where possible.
 * Max matches the historical shortboard tier ceiling.
 */
export const SURFBOARD_SHIPPING_PACK_BANDS: Record<
  SurfboardShippingPackBandId,
  SurfboardShippingPackBand
> = {
  shortboard_compact: {
    id: "shortboard_compact",
    label: "Compact",
    summary: "Tight pack — usually avoids UPS large-package surcharges",
    lengthIn: 72,
    widthIn: 22,
    heightIn: 6,
    weightLb: 18,
    maxBoardLengthIn: 70,
    maxBoardWidthIn: 20,
  },
  shortboard_standard: {
    id: "shortboard_standard",
    label: "Standard",
    summary: "Longer shortboard pack — targets ≤130″ DIM to avoid large-package rates",
    // 74 + 2×22 + 2×6 = 130″ DIM · 9,768 in³ (under AHC volume cliff)
    lengthIn: 74,
    widthIn: 22,
    heightIn: 6,
    weightLb: 20,
    maxBoardLengthIn: 72,
    maxBoardWidthIn: 20,
  },
  shortboard_max: {
    id: "shortboard_max",
    label: "Max",
    summary: "Full shortboard ceiling — same as today’s Shortboard max carton",
    lengthIn: SURFBOARD_TIER_SHORTBOARD_MAX_BOX_LENGTH_IN,
    widthIn: SURFBOARD_TIER_SHORTBOARD_PROFILE_WIDTH_IN,
    heightIn: SURFBOARD_TIER_SHORTBOARD_PROFILE_HEIGHT_IN,
    weightLb: 22,
    maxBoardLengthIn: 79,
    maxBoardWidthIn: 25,
  },
}

/** Inches of packing pad added to bare length when recommending a band. */
export const SHORTBOARD_PACK_BAND_LENGTH_PAD_IN = 2

/** Inches of packing pad added to bare width when recommending a band. */
export const SHORTBOARD_PACK_BAND_WIDTH_PAD_IN = 2

export function getSurfboardShippingPackBand(
  bandId: SurfboardShippingPackBandId,
): SurfboardShippingPackBand {
  return SURFBOARD_SHIPPING_PACK_BANDS[bandId]
}

export function surfboardShippingPackBandFixedParcel(bandId: SurfboardShippingPackBandId): {
  bandId: SurfboardShippingPackBandId
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  dimIn: number
} {
  const band = getSurfboardShippingPackBand(bandId)
  return {
    bandId,
    lengthIn: band.lengthIn,
    widthIn: band.widthIn,
    heightIn: band.heightIn,
    weightLb: band.weightLb,
    dimIn: surfboardShippingDimIn(band.lengthIn, band.widthIn, band.heightIn),
  }
}

export function surfboardShippingPackBandSummaryLine(
  bandId: SurfboardShippingPackBandId,
): string {
  const p = surfboardShippingPackBandFixedParcel(bandId)
  return `${p.weightLb} lb - ${p.lengthIn} x ${p.widthIn} x ${p.heightIn} in · DIM ${p.dimIn}"`
}

export function surfboardShippingPackBandSurchargeHints(
  bandId: SurfboardShippingPackBandId,
): ReturnType<typeof upsParcelSurchargeFlags> {
  const p = surfboardShippingPackBandFixedParcel(bandId)
  return upsParcelSurchargeFlags({
    lengthIn: p.lengthIn,
    widthIn: p.widthIn,
    heightIn: p.heightIn,
    weightLb: p.weightLb,
  })
}

/**
 * When parent tier is shortboard and band is missing, treat as Max (legacy listings).
 */
export function resolveSurfboardShippingPackBandId(input: {
  tierId: SurfboardShippingTierId | null
  bandId: string | null | undefined
}): SurfboardShippingPackBandId | null {
  if (input.tierId !== "shortboard") return null
  return parseSurfboardShippingPackBandId(input.bandId) ?? "shortboard_max"
}

export function surfboardShippingPackBandAllowsBoardSpecs(input: {
  bandId: SurfboardShippingPackBandId
  boardLength: string
  boardWidthInches?: string
}): boolean {
  return surfboardShippingPackBandBoardSpecsError(input) == null
}

export function surfboardShippingPackBandBoardSpecsError(input: {
  bandId: SurfboardShippingPackBandId
  boardLength: string
  boardWidthInches?: string
}): string | null {
  const band = getSurfboardShippingPackBand(input.bandId)
  const lengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
  if (lengthIn != null) {
    const packedLengthNeed = lengthIn + SHORTBOARD_PACK_BAND_LENGTH_PAD_IN
    if (packedLengthNeed > band.lengthIn) {
      return `This board needs about ${Math.ceil(packedLengthNeed)}" of packed length - pick a larger shortboard pack size.`
    }
  }
  const widthIn = maxBoardWidthInchesFromInput(input.boardWidthInches ?? "")
  if (widthIn != null) {
    const packedWidthNeed = widthIn + SHORTBOARD_PACK_BAND_WIDTH_PAD_IN
    if (packedWidthNeed > band.widthIn) {
      return `This board is too wide for ${band.label} (needs ~${Math.ceil(packedWidthNeed)}" packed width).`
    }
  }
  return null
}

/**
 * Smallest shortboard pack band that fits estimated packed L/W from board specs.
 * Falls back to Max when length/width unknown.
 */
export function resolveSurfboardShippingPackBandFromBoardSpecs(input: {
  boardLength: string
  boardWidthInches?: string
}): SurfboardShippingPackBandId {
  const lengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
  const widthIn = maxBoardWidthInchesFromInput(input.boardWidthInches ?? "")
  if (lengthIn == null && widthIn == null) return "shortboard_max"

  const packedLengthNeed =
    lengthIn != null ? lengthIn + SHORTBOARD_PACK_BAND_LENGTH_PAD_IN : 0
  const packedWidthNeed =
    widthIn != null ? widthIn + SHORTBOARD_PACK_BAND_WIDTH_PAD_IN : 0

  for (const bandId of SURFBOARD_SHIPPING_PACK_BAND_IDS) {
    const band = getSurfboardShippingPackBand(bandId)
    if (packedLengthNeed > 0 && packedLengthNeed > band.lengthIn) continue
    if (packedWidthNeed > 0 && packedWidthNeed > band.widthIn) continue
    return bandId
  }
  return "shortboard_max"
}

/** True when the band carton stays within Reswell’s UPS DIM ceiling. */
export function surfboardShippingPackBandWithinUpsDim(
  bandId: SurfboardShippingPackBandId,
): boolean {
  const p = surfboardShippingPackBandFixedParcel(bandId)
  return p.dimIn <= SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
}

export function surfboardShippingPackBandNextLarger(
  bandId: SurfboardShippingPackBandId,
): SurfboardShippingPackBandId | null {
  const idx = SURFBOARD_SHIPPING_PACK_BAND_IDS.indexOf(bandId)
  if (idx < 0 || idx >= SURFBOARD_SHIPPING_PACK_BAND_IDS.length - 1) return null
  return SURFBOARD_SHIPPING_PACK_BAND_IDS[idx + 1] ?? null
}

/**
 * Whether a board can ship via Reswell UPS (fits a shortboard pack band under the UPS DIM cap).
 * Midlength/longboard cartons exceed UPS parcel DIM and are not offered on /sell.
 */
export function resolveSurfboardUpsShippingAvailability(input: {
  boardLength: string
  boardWidthInches?: string
}): {
  shippingSupported: boolean
  /** Smallest fitting UPS-eligible pack band, or empty when unsupported / length unknown. */
  suggestedPackBandId: SurfboardShippingPackBandId | ""
} {
  if (!input.boardLength.trim()) {
    return { shippingSupported: true, suggestedPackBandId: "" }
  }

  const lengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
  if (lengthIn == null) {
    return { shippingSupported: true, suggestedPackBandId: "" }
  }

  for (const bandId of SURFBOARD_SHIPPING_PACK_BAND_IDS) {
    if (!surfboardShippingPackBandWithinUpsDim(bandId)) continue
    if (
      surfboardShippingPackBandBoardSpecsError({
        bandId,
        boardLength: input.boardLength,
        boardWidthInches: input.boardWidthInches,
      })
    ) {
      continue
    }
    return { shippingSupported: true, suggestedPackBandId: bandId }
  }

  return { shippingSupported: false, suggestedPackBandId: "" }
}
