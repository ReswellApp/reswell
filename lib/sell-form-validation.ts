import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"
import { flagsFromBoardFulfillment, type BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { isFinSetupTagSlug } from "@/lib/listing-fin-setup-tags"
import { isTailShapeTagSlug } from "@/lib/listing-tail-shape-tags"

/** Align with sell page length inputs (min/max on feet field). */
const BOARD_LENGTH_FT_MIN = 4
const BOARD_LENGTH_FT_MAX = 12

const BOARD_WIDTH_MIN = 14
const BOARD_WIDTH_MAX = 28
const BOARD_THICKNESS_MIN = 1
const BOARD_THICKNESS_MAX = 4

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
  const ftRaw = form.boardLengthFt?.trim() ?? ""
  if (ftRaw) {
    const ft = parseInt(ftRaw, 10)
    if (Number.isFinite(ft)) {
      const inchRaw = form.boardLengthIn?.trim() === "" ? "0" : (form.boardLengthIn ?? "0")
      const inches = parseFloat(inchRaw)
      const piece = Number.isFinite(inches) ? formatBoardInchesForTitle(inches) : "0"
      const boardLengthFmt = `${ft}'${piece}"`
      return listingTitleWithBoardLength(form.title, boardLengthFmt)
    }
  }
  return form.title.trim()
}

export function validateSellListingForm(
  form: SellFormValidationInput,
  opts: { imageCount: number; imagesUploadReady: boolean },
): string | null {
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

  if (!form.description?.trim()) {
    return "Description is required for surfboards."
  }
  if (!form.locationCity?.trim() || !form.locationState?.trim()) {
    return "Set a location on the map for your surfboard (pickup area or where you ship from)."
  }

  const ftRaw = form.boardLengthFt?.trim() ?? ""
  if (!ftRaw) {
    return "Board length (feet) is required."
  }
  const ft = parseInt(ftRaw, 10)
  if (!Number.isFinite(ft) || ft < BOARD_LENGTH_FT_MIN || ft > BOARD_LENGTH_FT_MAX) {
    return `Board length: enter feet between ${BOARD_LENGTH_FT_MIN} and ${BOARD_LENGTH_FT_MAX}.`
  }

  const inRaw = form.boardLengthIn?.trim() === "" ? "0" : (form.boardLengthIn ?? "0")
  const inches = parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) {
    return "Board length: inches must be 0 or greater and less than 12 (fractions like ⅞ are OK)."
  }

  if (!form.boardWidthInches?.trim()) {
    return "Enter board width (inches)."
  }
  const width = parseFloat(form.boardWidthInches.trim())
  if (!Number.isFinite(width) || width < BOARD_WIDTH_MIN || width > BOARD_WIDTH_MAX) {
    return `Board width must be between ${BOARD_WIDTH_MIN} and ${BOARD_WIDTH_MAX} inches.`
  }

  if (!form.boardThicknessInches?.trim()) {
    return "Enter board thickness (inches)."
  }
  const thick = parseFloat(form.boardThicknessInches.trim())
  if (!Number.isFinite(thick) || thick < BOARD_THICKNESS_MIN || thick > BOARD_THICKNESS_MAX) {
    return `Board thickness must be between ${BOARD_THICKNESS_MIN} and ${BOARD_THICKNESS_MAX} inches.`
  }

  if (form.boardVolumeL?.trim()) {
    const vol = parseFloat(form.boardVolumeL.trim())
    if (!Number.isFinite(vol) || vol <= 0 || vol > 200) {
      return "Volume must be a positive number (liters), or leave it blank."
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

  const minPhotos = 3
  if (opts.imageCount < minPhotos) {
    return `At least ${minPhotos} photos are required for this listing.`
  }

  if (!opts.imagesUploadReady) {
    return "Wait for all photos to finish uploading, or tap Retry on any that failed."
  }

  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (fulfillmentFlags.shipping_available) {
    const raw = form.boardShippingPrice?.trim() ?? ""
    if (!raw) {
      return "Enter a shipping price when offering shipping (use 0 for free shipping)."
    }
    const sp = parseFloat(raw)
    if (!Number.isFinite(sp) || sp < 0) {
      return "Shipping price must be a number ≥ 0."
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
  if (!Number.isFinite(inches)) return "0"
  return Number.isInteger(inches) ? String(inches) : String(Number(inches.toFixed(3)))
}
