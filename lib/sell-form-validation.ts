import { listingTitleWithBoardLength } from "@/lib/listing-title-board-length"
import { flagsFromBoardFulfillment, type BoardFulfillmentChoice } from "@/lib/listing-fulfillment"
import { WETSUIT_SIZE_OPTIONS, WETSUIT_THICKNESS_OPTIONS, WETSUIT_ZIP_VALUES } from "@/lib/wetsuit-options"
import { LEASH_LENGTH_FT_OPTIONS, LEASH_THICKNESS_OPTIONS } from "@/lib/leash-options"
import {
  COLLECTIBLE_CONDITION_VALUES,
  COLLECTIBLE_ERA_VALUES,
  COLLECTIBLE_TYPE_VALUES,
} from "@/lib/collectible-options"
import { APPAREL_KIND_VALUES, type ApparelKindValue } from "@/lib/apparel-lifestyle-options"

/** Match `public.categories` ids used on the sell form (used gear). */
const WETSUITS_CATEGORY_ID = "2744c29e-d6d4-43d9-a3ee-5bc11a0027df"
const LEASHES_CATEGORY_ID = "b2a6282c-4c23-42dc-83f4-492eaa4f993a"
const FINS_CATEGORY_ID = "f8327e72-d54c-4333-b383-58a8cef225a6"
const BACKPACK_CATEGORY_ID = "a6000006-0000-4000-8000-000000000006"
const BOARD_BAGS_CATEGORY_ID = "3779de38-dcf8-430f-a42c-9a17a2e048c4"
const APPAREL_LIFESTYLE_CATEGORY_ID = "a2000002-0000-4000-8000-000000000002"
const COLLECTIBLES_CATEGORY_ID = "a3000003-0000-4000-8000-000000000003"

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
  listingType: "used" | "board"
  title: string
  price: string
  description: string
  condition: string
  category: string
  brand: string
  gearSize: string
  gearColor: string
  packKind: "" | "surfpack" | "bag"
  boardBagKind: "" | "day" | "travel"
  apparelKind: string
  wetsuitSize: string
  wetsuitThickness: string
  wetsuitZipType: string
  leashLength: string
  leashThickness: string
  collectibleType: string
  collectibleEra: string
  collectibleCondition: string
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
  if (form.listingType === "board") {
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

  if (form.listingType === "board" && !form.boardType?.trim()) {
    return "Please select a board category."
  }

  if (form.listingType === "used" && !form.description?.trim()) {
    return "Description is required for used items."
  }

  if (form.listingType === "board") {
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

    if (!form.boardFins?.trim()) {
      return "Select a fin setup."
    }
    if (!form.boardTail?.trim()) {
      return "Select a tail shape."
    }
  }

  const minPhotos = form.listingType === "used" || form.listingType === "board" ? 3 : 0
  if (minPhotos > 0 && opts.imageCount < minPhotos) {
    return `At least ${minPhotos} photos are required for this listing.`
  }

  if (
    (form.listingType === "used" || form.listingType === "board") &&
    !opts.imagesUploadReady
  ) {
    return "Wait for all photos to finish uploading, or tap Retry on any that failed."
  }

  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (form.listingType === "board" && fulfillmentFlags.shipping_available) {
    const raw = form.boardShippingPrice?.trim() ?? ""
    if (!raw) {
      return "Enter a shipping price when offering shipping (use 0 for free shipping)."
    }
    const sp = parseFloat(raw)
    if (!Number.isFinite(sp) || sp < 0) {
      return "Shipping price must be a number ≥ 0."
    }
  }

  if (form.listingType === "used" && form.category) {
    const cat = form.category
    const needBrand =
      cat === FINS_CATEGORY_ID ||
      cat === BACKPACK_CATEGORY_ID ||
      cat === BOARD_BAGS_CATEGORY_ID ||
      cat === APPAREL_LIFESTYLE_CATEGORY_ID
    if (needBrand && !form.brand?.trim()) {
      return "Enter a brand for this item."
    }

    const needGearSize =
      cat === FINS_CATEGORY_ID ||
      cat === BACKPACK_CATEGORY_ID ||
      cat === BOARD_BAGS_CATEGORY_ID ||
      cat === APPAREL_LIFESTYLE_CATEGORY_ID
    if (needGearSize && !form.gearSize?.trim()) {
      return "Select or enter a size."
    }

    if (
      (cat === FINS_CATEGORY_ID || cat === BACKPACK_CATEGORY_ID) &&
      !form.gearColor?.trim()
    ) {
      return "Select or enter a color."
    }

    if (cat === BACKPACK_CATEGORY_ID && (form.packKind !== "surfpack" && form.packKind !== "bag")) {
      return "Select surfpack or bag."
    }

    if (
      cat === BOARD_BAGS_CATEGORY_ID &&
      (form.boardBagKind !== "day" && form.boardBagKind !== "travel")
    ) {
      return "Select day bag or travel bag."
    }

    if (cat === APPAREL_LIFESTYLE_CATEGORY_ID) {
      if (!APPAREL_KIND_VALUES.includes(form.apparelKind as ApparelKindValue)) {
        return "Select an apparel type."
      }
    }

    if (cat === WETSUITS_CATEGORY_ID) {
      if (!(WETSUIT_SIZE_OPTIONS as readonly string[]).includes(form.wetsuitSize.trim())) {
        return "Select a wetsuit size."
      }
      if (!(WETSUIT_THICKNESS_OPTIONS as readonly string[]).includes(form.wetsuitThickness.trim())) {
        return "Select wetsuit thickness."
      }
      if (!(WETSUIT_ZIP_VALUES as readonly string[]).includes(form.wetsuitZipType.trim())) {
        return "Select a zip type."
      }
    }

    if (cat === LEASHES_CATEGORY_ID) {
      if (!(LEASH_LENGTH_FT_OPTIONS as readonly string[]).includes(form.leashLength.trim())) {
        return "Select leash length."
      }
      if (!(LEASH_THICKNESS_OPTIONS as readonly string[]).includes(form.leashThickness.trim())) {
        return "Select leash thickness."
      }
    }

    if (cat === COLLECTIBLES_CATEGORY_ID) {
      if (!(COLLECTIBLE_TYPE_VALUES as readonly string[]).includes(form.collectibleType)) {
        return "Select a collectible type."
      }
      if (!(COLLECTIBLE_ERA_VALUES as readonly string[]).includes(form.collectibleEra)) {
        return "Select an era."
      }
      if (!(COLLECTIBLE_CONDITION_VALUES as readonly string[]).includes(form.collectibleCondition)) {
        return "Select condition."
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
  if (!Number.isFinite(inches)) return "0"
  return Number.isInteger(inches) ? String(inches) : String(Number(inches.toFixed(3)))
}
