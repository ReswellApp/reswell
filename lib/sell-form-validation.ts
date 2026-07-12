import {
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"

/** How shipping cost is set when shipping is enabled (surfboard sell flow). */
export type BoardShippingCostMode = "reswell" | "free" | "flat"
import {
  formatDecimalDimension,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"
import { isListingSellableCondition } from "@/lib/listing-labels"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  validateReswellPackedWeightRequired,
} from "@/lib/reswell-parcel-fields"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

/**
 * Listing titles become URL slugs; keep them short so links stay readable in messages and search.
 * (See {@link slugify} — slug is derived from title.)
 */
export const LISTING_TITLE_MAX_LENGTH = 60

/** Minimum photos required to publish. More is strongly encouraged in the sell UI. */
export const LISTING_MIN_PHOTOS = 1

/** Max length for free-text board model on the sell form (matches catalog admin hints). */
export const LISTING_BOARD_MODEL_MAX_LENGTH = 200

export type SellFormValidationInput = {
  listingType: "board"
  title: string
  price: string
  description: string
  condition: string
  category: string
  brand: string
  /** Surfboard model name (persisted to catalog snapshot `model_name`). */
  boardModelName: string
  boardType: string
  /** Combined feet/inches, e.g. `6'2` or `10'8` */
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  boardFins: string
  boardTail: string
  boardFulfillment: BoardFulfillmentChoice
  boardShippingCostMode: BoardShippingCostMode
  boardShippingPrice: string
  /** Packed parcel for Reswell: length = feet'inches (e.g. 6'1) or outer inches; W/H same inch style as Dimensions; DB stores carrier-ready inches. */
  reswellPackageLengthIn?: string
  reswellPackageWidthIn?: string
  reswellPackageHeightIn?: string
  reswellPackageWeightLb?: string
  reswellPackageWeightOz?: string
  /** Scheduled price drop (2 weeks) — seller sets floor via `autoPriceDropFloor`. */
  autoPriceDrop: boolean
  autoPriceDropFloor: string
  locationCity: string
  locationState: string
}

/**
 * Title string used for max-length validation and the live character counter (what we persist as `listings.title`).
 */
export function buildResolvedListingTitle(form: SellFormValidationInput): string {
  return form.title.trim()
}

export function validateSellListingForm(
  form: SellFormValidationInput,
  opts: {
    imageCount: number
    imagesUploadReady: boolean
    /** Admin editing another user's listing via impersonation — allow legacy rows that predate newer required fields. */
    adminImpersonationEdit?: boolean
  },
): string | null {
  const relaxed = opts.adminImpersonationEdit === true

  if (!form.title?.trim()) {
    return "Please enter a listing title."
  }
  if (!form.price?.trim()) {
    return "Enter a listing price."
  }
  if (!form.condition) {
    return "Please select a condition."
  }

  if (
    !relaxed &&
    form.boardModelName &&
    form.boardModelName.trim().length > LISTING_BOARD_MODEL_MAX_LENGTH
  ) {
    return `Model must be ${LISTING_BOARD_MODEL_MAX_LENGTH} characters or fewer.`
  }

  if (!isListingSellableCondition(form.condition)) {
    return "Please select a condition."
  }

  const price = parseFloat(form.price.trim())
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return `Enter a valid price between $${PRICE_MIN} and $${PRICE_MAX.toLocaleString()}.`
  }

  if (!form.category?.trim()) {
    return "Please select a category."
  }

  if (!form.boardType?.trim()) {
    return "Please select a board category."
  }

  if (!relaxed) {
    if (!form.description?.trim()) {
      return "Description is required for surfboards."
    }
    if (!form.locationCity?.trim() || !form.locationState?.trim()) {
      return "Set a location on the map for your surfboard (pickup area or where you ship from)."
    }
  }

  const lenRaw = form.boardLength?.trim() ?? ""
  const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
  const validateFilledLength = (): string | null => {
    if (!lenRaw || !feetStr) {
      return "Board length: enter feet and inches (e.g. 6'2), or leave blank."
    }
    const ft = parseLengthFeet(feetStr)
    if (ft == null || ft < 1 || ft > 15) {
      return "Board length: enter whole feet (1–15)."
    }
    const inRaw = inchesStr.trim() === "" ? "0" : inchesStr
    const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      return "Board length: inches must be under 12 (e.g. 0, 2, 2.5, or 2 1/2), or leave blank for 0."
    }
    return null
  }

  if (lenRaw) {
    const lenErr = validateFilledLength()
    if (lenErr) return lenErr
  }

  const validateWidthThicknessIfFilled = (): string | null => {
    if (form.boardWidthInches?.trim()) {
      const width =
        parseBoardMeasurement(form.boardWidthInches.trim()) ??
        Number.parseFloat(form.boardWidthInches.trim())
      if (!Number.isFinite(width) || width <= 0) {
        return "Board width: enter a number (decimals or fractions like 19 1/2 are OK)."
      }
    }
    if (form.boardThicknessInches?.trim()) {
      const thick =
        parseBoardMeasurement(form.boardThicknessInches.trim()) ??
        Number.parseFloat(form.boardThicknessInches.trim())
      if (!Number.isFinite(thick) || thick <= 0) {
        return "Board thickness: enter a number (decimals or fractions are OK)."
      }
    }
    return null
  }

  const wtErr = validateWidthThicknessIfFilled()
  if (wtErr) return wtErr

  if (form.boardVolumeL?.trim()) {
    const vol = parseVolumeLiters(form.boardVolumeL.trim())
    if (vol == null || vol > 200) {
      return "Volume: enter liters as a number (or leave blank)."
    }
  }

  if (!relaxed) {
    if (opts.imageCount < LISTING_MIN_PHOTOS) {
      return `At least ${LISTING_MIN_PHOTOS} photo is required for this listing.`
    }
  }

  if (!opts.imagesUploadReady) {
    return "Wait for all photos to finish uploading, or tap Retry on any that failed."
  }

  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (fulfillmentFlags.shipping_available) {
    const mode = form.boardShippingCostMode ?? "reswell"
    if (mode === "flat") {
      const raw = form.boardShippingPrice?.trim() ?? ""
      if (!raw && !relaxed) {
        return "Enter a flat shipping amount, or choose free shipping instead."
      }
      if (raw) {
        const sp = parseFloat(raw)
        if (!Number.isFinite(sp) || sp < 0) {
          return "Flat shipping must be a number ≥ 0."
        }
      }
    }
    if (mode === "reswell" && !relaxed) {
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
        return "Enter packed box width — use the same inches as in Dimensions (decimals or fractions) for Reswell shipping."
      }
      if (H == null || H <= 0) {
        return "Enter packed box height — use the same inches as board thickness (decimals or fractions) for Reswell shipping."
      }
      const weightErr = validateReswellPackedWeightRequired(
        form.reswellPackageWeightLb,
        form.reswellPackageWeightOz,
      )
      if (weightErr) return weightErr
    }
  }

  if (!relaxed && form.autoPriceDrop) {
    const floorRaw = form.autoPriceDropFloor?.trim() ?? ""
    if (!floorRaw) {
      return "Enter the lowest price you allow after 2 weeks, or turn off automatic price drop."
    }
    const floor = parseFloat(floorRaw.replace(/,/g, ""))
    if (!Number.isFinite(floor) || floor < PRICE_MIN || floor > PRICE_MAX) {
      return `Lowest-after-drop price must be between $${PRICE_MIN} and $${PRICE_MAX.toLocaleString()}.`
    }
    if (floor >= price) {
      return "Lowest-after-drop price must be less than your current list price."
    }
  }

  const resolvedTitle = buildResolvedListingTitle(form)
  if (resolvedTitle.length > LISTING_TITLE_MAX_LENGTH) {
    return `Title must be ${LISTING_TITLE_MAX_LENGTH} characters or fewer. Shorter titles keep your listing URL clean.`
  }

  return null
}

/** For API title generation; keeps fractional inches readable. */
export function formatBoardInchesForTitle(inches: number): string {
  return formatDecimalDimension(inches) || "0"
}
