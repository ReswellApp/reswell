import {
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"

/** How shipping cost is set when shipping is enabled (surfboard sell flow). */
/** Surfboard /sell UI is Reswell-only; `free` / `flat` remain for legacy DB rows & other sell flows. */
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
  parseSurfboardShippingTierId,
  validateSurfboardShippingTierParcelLimits,
} from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandBoardSpecsError,
  surfboardShippingPackBandFixedParcel,
} from "@/lib/surfboard-shipping-pack-bands"

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
  /** Seller-selected Reswell surfboard shipping tier. */
  surfboardShippingTier?: string
  /** Seller confirmed packed board fits the selected tier ceiling (Reswell mode). */
  surfboardShippingTierCeilingConfirmed?: boolean
  /** Shortboard pack band (compact / standard / max). */
  surfboardShippingPackBand?: string
  /** Seller confirmed packed board fits the selected shortboard pack band. */
  surfboardShippingPackBandCeilingConfirmed?: boolean
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
  // Reswell /sell shipping is UPS shortboard pack bands only (auto-picked Compact/Standard/Max).
  if (fulfillmentFlags.shipping_available && !relaxed) {
    if (!form.boardLength.trim()) {
      return "Enter board length so we can set up shipping for this listing."
    }
    const tierId = parseSurfboardShippingTierId(form.surfboardShippingTier)
    if (tierId !== "shortboard") {
      return "Shipping isn't available for this board — it exceeds UPS size limits. Use local pickup."
    }
    const bandId = parseSurfboardShippingPackBandId(form.surfboardShippingPackBand)
    if (!bandId) {
      return "Shipping is still setting up — wait a moment or re-enter board length."
    }
    const bandErr = surfboardShippingPackBandBoardSpecsError({
      bandId,
      boardLength: form.boardLength,
      boardWidthInches: form.boardWidthInches,
    })
    if (bandErr) return bandErr
    const band = surfboardShippingPackBandFixedParcel(bandId)
    const limitCheck = validateSurfboardShippingTierParcelLimits(tierId, {
      lengthIn: band.lengthIn,
      widthIn: band.widthIn,
      heightIn: band.heightIn,
      weightLb: band.weightLb,
    })
    if (!limitCheck.ok) {
      return "Shipping isn't available for this board — it exceeds UPS size limits. Use local pickup."
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
