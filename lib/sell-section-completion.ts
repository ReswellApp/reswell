import {
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"
import { flagsFromBoardFulfillment } from "@/lib/listing-fulfillment"
import {
  buildResolvedListingTitle,
  LISTING_BOARD_MODEL_MAX_LENGTH,
  LISTING_MIN_PHOTOS,
  LISTING_TITLE_MAX_LENGTH,
  validateSellListingForm,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import { parseSurfboardShippingTierId } from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandBoardSpecsError,
} from "@/lib/surfboard-shipping-pack-bands"
import {
  isReswellPackedWeightComplete,
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

function photosTitleSectionComplete(form: SellFormValidationInput): boolean {
  if (!form.title?.trim()) return false
  return buildResolvedListingTitle(form).length <= LISTING_TITLE_MAX_LENGTH
}

function brandModelComplete(form: SellFormValidationInput): boolean {
  const model = form.boardModelName?.trim() ?? ""
  if (
    !form.brand?.trim() ||
    !model ||
    model.length > LISTING_BOARD_MODEL_MAX_LENGTH
  ) {
    return false
  }
  return true
}

function shapeSectionComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.category?.trim() && form.boardType?.trim())
}

function dimensionsSectionComplete(form: SellFormValidationInput): boolean {
  const shippingRequiresDims = flagsFromBoardFulfillment(form.boardFulfillment).shipping_available
  const lenRaw = form.boardLength?.trim() ?? ""

  // Pickup-only: dimensions stay optional. Shipping: length, width, and thickness required.
  if (!lenRaw) return !shippingRequiresDims

  const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
  if (!feetStr) return false
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return false

  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return false

  if (shippingRequiresDims) {
    if (!form.boardWidthInches?.trim()) return false
    const width =
      parseBoardMeasurement(form.boardWidthInches.trim()) ??
      Number.parseFloat(form.boardWidthInches.trim())
    if (!Number.isFinite(width) || width <= 0) return false

    if (!form.boardThicknessInches?.trim()) return false
    const thick =
      parseBoardMeasurement(form.boardThicknessInches.trim()) ??
      Number.parseFloat(form.boardThicknessInches.trim())
    if (!Number.isFinite(thick) || thick <= 0) return false
  } else {
    if (form.boardWidthInches?.trim()) {
      const width =
        parseBoardMeasurement(form.boardWidthInches.trim()) ??
        Number.parseFloat(form.boardWidthInches.trim())
      if (!Number.isFinite(width) || width <= 0) return false
    }
    if (form.boardThicknessInches?.trim()) {
      const thick =
        parseBoardMeasurement(form.boardThicknessInches.trim()) ??
        Number.parseFloat(form.boardThicknessInches.trim())
      if (!Number.isFinite(thick) || thick <= 0) return false
    }
  }

  if (form.boardVolumeL?.trim()) {
    const vol = parseVolumeLiters(form.boardVolumeL.trim())
    if (vol == null || vol > 200) return false
  }

  return true
}

function deliverySectionComplete(form: SellFormValidationInput): boolean {
  if (!form.locationCity?.trim() || !form.locationState?.trim()) return false

  const fulfillmentFlags = flagsFromBoardFulfillment(form.boardFulfillment)
  if (fulfillmentFlags.shipping_available) {
    const shippingMode = form.boardShippingCostMode ?? "reswell"
    if (shippingMode === "free") {
      // Admin free shipping — no pack band required.
    } else if (shippingMode === "flat") {
      const raw = String(form.boardShippingPrice ?? "").trim().replace(/,/g, "")
      const n = Number.parseFloat(raw)
      if (!raw || !Number.isFinite(n) || n < 0) return false
    } else if (form.adminCustomShippingCarton === true) {
      // Admin custom carton — packed L×W×H + weight.
      if (!form.boardLength.trim()) return false
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
      if (!isReswellPackedWeightComplete(form.reswellPackageWeightLb, form.reswellPackageWeightOz)) {
        return false
      }
    } else {
      // Reswell mode only — UPS shortboard pack bands (free/flat skip this).
      if (!form.boardLength.trim()) return false
      if (parseSurfboardShippingTierId(form.surfboardShippingTier) !== "shortboard") return false
      const bandId = parseSurfboardShippingPackBandId(form.surfboardShippingPackBand)
      if (!bandId) return false
      if (
        surfboardShippingPackBandBoardSpecsError({
          bandId,
          boardLength: form.boardLength,
          boardWidthInches: form.boardWidthInches,
        })
      ) {
        return false
      }
    }
  }

  if (form.autoPriceDrop) {
    const floorRaw = form.autoPriceDropFloor?.trim() ?? ""
    if (!floorRaw) return false
    const floor = parseFloat(floorRaw.replace(/,/g, ""))
    const price = parseFloat(form.price?.trim() ?? "")
    if (!Number.isFinite(floor) || floor < PRICE_MIN || floor > PRICE_MAX) return false
    if (!Number.isFinite(price) || floor >= price) return false
  }

  return true
}

function descriptionSectionComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.condition?.trim() && form.description?.trim())
}

/**
 * Per-section completion for the `/sell` desktop stepper. Rules mirror
 * {@link validateSellListingForm} field groups so checkmarks match what’s left to publish.
 *
 * Delivery (`sell-section-delivery`): the `/sell` page may additionally require scroll + explicit
 * `LocationPicker` confirmation before marking that step complete in the rail (prefill alone cannot),
 * unless the form already carries map coordinates from draft restore / hydrate.
 */
export function computeSellSectionCompletion(
  form: SellFormValidationInput,
  opts: { imageCount: number; imagesUploadReady: boolean },
): Record<string, boolean> {
  const publishComplete =
    validateSellListingForm(form, {
      imageCount: opts.imageCount,
      imagesUploadReady: opts.imagesUploadReady,
      adminImpersonationEdit: false,
    }) === null

  return {
    "sell-section-photos-title":
      photosTitleSectionComplete(form) &&
      opts.imageCount >= LISTING_MIN_PHOTOS &&
      opts.imagesUploadReady,
    "sell-section-board":
      brandModelComplete(form) &&
      shapeSectionComplete(form) &&
      dimensionsSectionComplete(form) &&
      descriptionSectionComplete(form),
    "sell-section-delivery": deliverySectionComplete(form),
    "sell-section-publish": publishComplete,
  }
}
