import {
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
} from "@/lib/board-measurements"
import type { BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { flagsFromBoardFulfillment } from "@/lib/listing-fulfillment"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import {
  listingUsesReswellCarrierQuote,
  resolveListingReswellParcel,
  surfboardListingHasRequiredBoardDimensions,
  type ListingReswellShippabilityInput,
} from "@/lib/services/listingReswellShippability"

type BoardShippingCostMode = "reswell" | "free" | "flat"

/** Persisted surfboard listing row fields validated on create/update. */
export type SurfboardListingShippingRow = ListingReswellShippabilityInput & {
  section?: string | null
}

/** Sell-form slice validated before publish (surfboard `/sell`). */
export type SurfboardSellFormShippingInput = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardFulfillment: BoardFulfillmentChoice
  boardShippingCostMode?: BoardShippingCostMode
  reswellPackageLengthIn?: string
  reswellPackageWidthIn?: string
  reswellPackageHeightIn?: string
  reswellPackageWeightLb?: string
  reswellPackageWeightOz?: string
}

function validateSurfboardBoardDimensionsForReswell(form: SurfboardSellFormShippingInput): string | null {
  const lenRaw = form.boardLength?.trim() ?? ""
  const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
  if (!lenRaw || !feetStr) {
    return "Enter board length in Dimensions — required for Reswell shipping."
  }
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) {
    return "Board length: enter whole feet (1–15) for Reswell shipping."
  }
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
    return "Board length: inches must be under 12 for Reswell shipping."
  }

  if (!form.boardWidthInches?.trim()) {
    return "Enter board width in Dimensions — required for Reswell shipping."
  }
  const width =
    parseBoardMeasurement(form.boardWidthInches.trim()) ??
    Number.parseFloat(form.boardWidthInches.trim())
  if (!Number.isFinite(width) || width <= 0) {
    return "Board width: enter a valid number for Reswell shipping."
  }

  if (!form.boardThicknessInches?.trim()) {
    return "Enter board thickness in Dimensions — required for Reswell shipping."
  }
  const thick =
    parseBoardMeasurement(form.boardThicknessInches.trim()) ??
    Number.parseFloat(form.boardThicknessInches.trim())
  if (!Number.isFinite(thick) || thick <= 0) {
    return "Board thickness: enter a valid number for Reswell shipping."
  }

  return null
}

function validateSurfboardReswellPackedFields(form: SurfboardSellFormShippingInput): string | null {
  const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
  if (L == null || L <= 0) {
    const raw = form.reswellPackageLengthIn?.trim() ?? ""
    const hasPrime = raw.replace(/[\u2032\u2019＇]/g, "'").includes("'")
    return hasPrime
      ? "Packed length: check feet and inches (e.g. 6'1) or use total outer length in inches."
      : "Enter packed length — feet'inches such as 6'1 from your Dimensions, or outer box length in inches."
  }
  if (W == null || W <= 0) {
    return "Enter packed box width — use the same inches as in Dimensions for Reswell shipping."
  }
  if (H == null || H <= 0) {
    return "Enter packed box height — use the same inches as board thickness for Reswell shipping."
  }

  const lbRaw = form.reswellPackageWeightLb?.trim() ?? ""
  const ozRaw = form.reswellPackageWeightOz?.trim() ?? ""
  const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
  const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0) {
    return "Enter a valid packed weight (pounds and ounces), or leave both fields blank."
  }
  if (oz >= 16) {
    return "Ounces must be under 16 — add whole pounds in the pounds field instead."
  }
  if (lbRaw !== "" || ozRaw !== "") {
    const totalOz = lb * 16 + oz
    if (!Number.isFinite(totalOz) || totalOz <= 0) {
      return "Enter a positive packed weight, or leave both fields blank if you do not know it yet."
    }
  }

  return null
}

/** Validates sell-form Reswell shipping requirements (always enforced — not relaxed for admin). */
export function validateSurfboardSellFormReswellShipping(
  form: SurfboardSellFormShippingInput,
): string | null {
  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (!fulfillmentFlags.shipping_available) return null

  const mode = form.boardShippingCostMode ?? "reswell"
  if (mode !== "reswell") return null

  const boardErr = validateSurfboardBoardDimensionsForReswell(form)
  if (boardErr) return boardErr

  return validateSurfboardReswellPackedFields(form)
}

/**
 * Server-side guard for surfboard listing rows before insert/update.
 * Returns an error message or null when shipping settings are OK (or shipping is off).
 */
export function validateSurfboardListingShippingForSave(row: SurfboardListingShippingRow): string | null {
  if (row.section !== "surfboards") return null
  if (!row.shipping_available) return null
  if (!listingUsesReswellCarrierQuote(row)) return null

  if (!surfboardListingHasRequiredBoardDimensions(row.dimensions)) {
    return "Board length, width, and thickness are required in Dimensions when Reswell shipping is enabled."
  }

  const parcel = resolveListingReswellParcel(row)
  if (!parcel.ok) return parcel.error

  return null
}
