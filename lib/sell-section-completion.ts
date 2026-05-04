import {
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"
import { flagsFromBoardFulfillment } from "@/lib/listing-fulfillment"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import {
  buildResolvedListingTitle,
  LISTING_BOARD_MODEL_MAX_LENGTH,
  LISTING_MIN_PHOTOS,
  LISTING_TITLE_MAX_LENGTH,
  validateSellListingForm,
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

function photosTitleSectionComplete(form: SellFormValidationInput): boolean {
  if (!form.title?.trim()) return false
  return buildResolvedListingTitle(form).length <= LISTING_TITLE_MAX_LENGTH
}

function brandModelComplete(form: SellFormValidationInput): boolean {
  const model = form.boardModelName?.trim() ?? ""
  if (model.length > LISTING_BOARD_MODEL_MAX_LENGTH) return false
  return true
}

function shapeSectionComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.category?.trim() && form.boardType?.trim())
}

function dimensionsSectionComplete(form: SellFormValidationInput): boolean {
  const lenRaw = form.boardLength?.trim() ?? ""
  if (lenRaw) {
    const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
    if (!feetStr) return false
    const ft = parseLengthFeet(feetStr)
    if (ft == null || ft < 1 || ft > 15) return false

    const inRaw = inchesStr.trim() === "" ? "0" : inchesStr
    const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
    if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return false
  }

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
    const mode = form.boardShippingCostMode ?? "reswell"
    if (mode === "flat") {
      const raw = form.boardShippingPrice?.trim() ?? ""
      if (!raw) return false
      const sp = parseFloat(raw)
      if (!Number.isFinite(sp) || sp < 0) return false
    }
    if (mode === "reswell") {
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false

      const lbRaw = form.reswellPackageWeightLb?.trim() ?? ""
      const ozRaw = form.reswellPackageWeightOz?.trim() ?? ""
      const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
      const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
      if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0) return false
      if (oz >= 16) return false
      const totalOz = lb * 16 + oz
      if (!Number.isFinite(totalOz) || totalOz <= 0) return false
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
