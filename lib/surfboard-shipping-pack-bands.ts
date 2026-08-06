/**
 * Shortboard pack bands — fixed cartons under the Shortboard family.
 *
 * Checkout quotes and labels use the selected band carton (not always Medium).
 * Two sizes only, both at or under the 130″ UPS large-package DIM cliff:
 *   Compact — 72×22×4 (DIM 124″)
 *   Medium  — 78×22×4 (DIM 130″) for boards above 72″ packed length
 */

import {
  maxBoardWidthInchesFromInput,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN,
  surfboardShippingDimIn,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"
import { upsParcelSurchargeFlags, UPS_LARGE_PACKAGE_DIM_IN } from "@/lib/shipping/ups-parcel-surcharge-flags"
import type { SurfboardShippingTierId } from "@/lib/surfboard-shipping-tiers"

export type SurfboardShippingPackBandId = "shortboard_compact" | "shortboard_medium"

/** Legacy DB / URL values mapped to the current two-band catalog. */
const LEGACY_SURFBOARD_PACK_BAND_ALIASES: Partial<
  Record<string, SurfboardShippingPackBandId>
> = {
  shortboard_standard: "shortboard_medium",
  shortboard_max: "shortboard_medium",
}

export const SURFBOARD_SHIPPING_PACK_BAND_IDS: SurfboardShippingPackBandId[] = [
  "shortboard_compact",
  "shortboard_medium",
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
  if (isSurfboardShippingPackBandId(trimmed)) return trimmed
  return LEGACY_SURFBOARD_PACK_BAND_ALIASES[trimmed] ?? null
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
 * Locked shortboard pack bands — every carton must stay at or under {@link UPS_LARGE_PACKAGE_DIM_IN}
 * (130″ DIM) so Reswell UPS quotes avoid large-package surcharges, and under
 * {@link SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN} (160″ Reswell UPS parcel cap).
 */
export const SURFBOARD_SHIPPING_PACK_BANDS: Record<
  SurfboardShippingPackBandId,
  SurfboardShippingPackBand
> = {
  shortboard_compact: {
    id: "shortboard_compact",
    label: "Compact",
    summary: "Tight pack — stays under UPS large-package DIM (130″)",
    lengthIn: 72,
    widthIn: 22,
    heightIn: 4,
    weightLb: 18,
    maxBoardLengthIn: 71,
    maxBoardWidthIn: 21,
  },
  shortboard_medium: {
    id: "shortboard_medium",
    label: "Medium",
    summary: "Longer shortboard pack — max length at the 130″ UPS DIM ceiling",
    lengthIn: 78,
    widthIn: 22,
    heightIn: 4,
    weightLb: 22,
    maxBoardLengthIn: 77,
    maxBoardWidthIn: 21,
  },
}

/** Inches of packing pad added to bare length when recommending a band. */
export const SHORTBOARD_PACK_BAND_LENGTH_PAD_IN = 1

/** Inches of packing pad added to bare width when recommending a band. */
export const SHORTBOARD_PACK_BAND_WIDTH_PAD_IN = 1

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
 * When parent tier is shortboard and band is missing, treat as Medium (legacy listings).
 * Prefer {@link parseSurfboardShippingPackBandId} when distinguishing admin custom cartons
 * (null band + stored packed dims) from legacy Medium.
 */
export function resolveSurfboardShippingPackBandId(input: {
  tierId: SurfboardShippingTierId | null
  bandId: string | null | undefined
}): SurfboardShippingPackBandId | null {
  if (input.tierId !== "shortboard") return null
  return parseSurfboardShippingPackBandId(input.bandId) ?? "shortboard_medium"
}

/** True when L×W×H match a pack-band carton exactly (weight ignored). */
export function surfboardShippingPackBandMatchesParcel(
  bandId: SurfboardShippingPackBandId,
  parcel: { lengthIn: number; widthIn: number; heightIn: number },
): boolean {
  const band = surfboardShippingPackBandFixedParcel(bandId)
  return (
    band.lengthIn === parcel.lengthIn &&
    band.widthIn === parcel.widthIn &&
    band.heightIn === parcel.heightIn
  )
}

/** Which pack band matches these carton dims, if any. */
export function matchSurfboardShippingPackBandFromParcel(parcel: {
  lengthIn: number
  widthIn: number
  heightIn: number
}): SurfboardShippingPackBandId | null {
  for (const bandId of SURFBOARD_SHIPPING_PACK_BAND_IDS) {
    if (surfboardShippingPackBandMatchesParcel(bandId, parcel)) return bandId
  }
  return null
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
 * Falls back to Medium when length/width unknown.
 */
export function resolveSurfboardShippingPackBandFromBoardSpecs(input: {
  boardLength: string
  boardWidthInches?: string
}): SurfboardShippingPackBandId {
  const lengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
  const widthIn = maxBoardWidthInchesFromInput(input.boardWidthInches ?? "")
  if (lengthIn == null && widthIn == null) return "shortboard_medium"

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
  return "shortboard_medium"
}

/** True when the band carton stays within Reswell’s UPS DIM ceiling (160″). */
export function surfboardShippingPackBandWithinUpsDim(
  bandId: SurfboardShippingPackBandId,
): boolean {
  const p = surfboardShippingPackBandFixedParcel(bandId)
  return p.dimIn <= SURFBOARD_LABEL_MAX_UPS_DIMENSION_TOTAL_IN
}

/** True when the band carton stays at or under the UPS large-package DIM cliff (130″). */
export function surfboardShippingPackBandWithinLargePackageDim(
  bandId: SurfboardShippingPackBandId,
): boolean {
  const p = surfboardShippingPackBandFixedParcel(bandId)
  return p.dimIn <= UPS_LARGE_PACKAGE_DIM_IN
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

export function assertSurfboardShippingPackBandsWithinCarrierLimits(): void {
  for (const bandId of SURFBOARD_SHIPPING_PACK_BAND_IDS) {
    const parcel = surfboardShippingPackBandFixedParcel(bandId)
    const upsCheck = validateSurfboardLabelParcelLimits({
      lengthIn: parcel.lengthIn,
      widthIn: parcel.widthIn,
      heightIn: parcel.heightIn,
      weightLb: parcel.weightLb,
    })
    if (!upsCheck.ok) {
      throw new Error(`Surfboard pack band "${bandId}" exceeds UPS limits: ${upsCheck.error}`)
    }
    if (parcel.dimIn > UPS_LARGE_PACKAGE_DIM_IN) {
      throw new Error(
        `Surfboard pack band "${bandId}" exceeds UPS large-package DIM (${UPS_LARGE_PACKAGE_DIM_IN}" max, got ${parcel.dimIn}")`,
      )
    }
  }
}

assertSurfboardShippingPackBandsWithinCarrierLimits()
