import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"
import { flagsFromBoardFulfillment, type BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { isFinSetupTagSlug } from "@/lib/listing-fin-setup-tags"
import { isTailShapeTagSlug } from "@/lib/listing-tail-shape-tags"
import {
  formatBoardLengthForTitle,
  formatDecimalDimension,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

/**
 * Listing titles become URL slugs; keep them short so links stay readable in messages and search.
 * (See {@link slugify} — slug is derived from title.)
 */
export const LISTING_TITLE_MAX_LENGTH = 60

export type SellFormValidationInput = {
  listingType: "board"
  title: string
  price: string
  description: string
  condition: string
  category: string
  brand: string
  boardType: string
  boardLengthFt: string
  boardLengthIn: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  boardFins: string
  boardTail: string
  boardFulfillment: BoardFulfillmentChoice
  boardShippingPrice: string
  locationCity: string
  locationState: string
}

/**
 * Same title string the sell flow saves (surfboards append length when set).
 * Used for max-length validation and the live character counter.
 */
export function buildResolvedListingTitle(form: SellFormValidationInput): string {
  const boardLengthFmt = formatBoardLengthForTitle(
    form.boardLengthFt ?? "",
    form.boardLengthIn ?? "",
  )
  if (boardLengthFmt) {
    return listingTitleWithBoardLength(form.title, boardLengthFmt)
  }
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

  if (!form.title?.trim() || !form.price?.trim() || !form.condition) {
    return "Please fill in all required fields."
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

  const ftRaw = form.boardLengthFt?.trim() ?? ""
  if (!relaxed) {
    if (!ftRaw) {
      return "Board length (feet) is required."
    }
    const ft = parseLengthFeet(ftRaw)
    if (ft == null || ft < 1 || ft > 15) {
      return "Board length: enter whole feet (1–15)."
    }

    const inRaw = form.boardLengthIn?.trim() === "" ? "0" : (form.boardLengthIn ?? "0")
    const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      return "Board length: inches must be under 12 (e.g. 0, 2, 2.5, or 2 1/2), or leave blank for 0."
    }

    if (!form.boardWidthInches?.trim()) {
      return "Enter board width (inches)."
    }
    const width =
      parseBoardMeasurement(form.boardWidthInches.trim()) ??
      Number.parseFloat(form.boardWidthInches.trim())
    if (!Number.isFinite(width) || width <= 0) {
      return "Board width: enter a number (decimals or fractions like 19 1/2 are OK)."
    }

    if (!form.boardThicknessInches?.trim()) {
      return "Enter board thickness (inches)."
    }
    const thick =
      parseBoardMeasurement(form.boardThicknessInches.trim()) ??
      Number.parseFloat(form.boardThicknessInches.trim())
    if (!Number.isFinite(thick) || thick <= 0) {
      return "Board thickness: enter a number (decimals or fractions are OK)."
    }
  } else if (ftRaw) {
    const ft = parseLengthFeet(ftRaw)
    if (ft == null || ft < 1 || ft > 15) {
      return "Board length: enter whole feet (1–15)."
    }

    const inRaw = form.boardLengthIn?.trim() === "" ? "0" : (form.boardLengthIn ?? "0")
    const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
      return "Board length: inches must be under 12 (e.g. 0, 2, 2.5, or 2 1/2), or leave blank for 0."
    }
  }

  if (relaxed) {
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
  }

  if (form.boardVolumeL?.trim()) {
    const vol = parseVolumeLiters(form.boardVolumeL.trim())
    if (vol == null || vol > 200) {
      return "Volume: enter liters as a number (or leave blank)."
    }
  }

  const finSlug = form.boardFins?.trim().toLowerCase() ?? ""
  if (finSlug && !isFinSetupTagSlug(finSlug)) {
    return "Pick a valid fin setup or leave it unset."
  }
  const tailSlug = form.boardTail?.trim().toLowerCase() ?? ""
  if (tailSlug && !isTailShapeTagSlug(tailSlug)) {
    return "Pick a valid tail shape or leave it unset."
  }

  if (!relaxed) {
    const minPhotos = 3
    if (opts.imageCount < minPhotos) {
      return `At least ${minPhotos} photos are required for this listing.`
    }
  }

  if (!opts.imagesUploadReady) {
    return "Wait for all photos to finish uploading, or tap Retry on any that failed."
  }

  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (fulfillmentFlags.shipping_available) {
    const raw = form.boardShippingPrice?.trim() ?? ""
    if (!raw && !relaxed) {
      return "Enter a shipping price when offering shipping (use 0 for free shipping)."
    }
    if (raw) {
      const sp = parseFloat(raw)
      if (!Number.isFinite(sp) || sp < 0) {
        return "Shipping price must be a number ≥ 0."
      }
    }
  }

  const resolvedTitle = buildResolvedListingTitle(form)
  if (resolvedTitle.length > LISTING_TITLE_MAX_LENGTH) {
    return `Title must be ${LISTING_TITLE_MAX_LENGTH} characters or fewer (including board length in the title). Shorter titles keep your listing URL clean.`
  }

  return null
}

/** For API title generation; keeps fractional inches readable. */
export function formatBoardInchesForTitle(inches: number): string {
  return formatDecimalDimension(inches) || "0"
}
