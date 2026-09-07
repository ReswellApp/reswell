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
  type SellFormValidationInput,
} from "@/lib/sell-form-validation"
import {
  isReswellPackedWeightComplete,
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

function titleComplete(form: SellFormValidationInput): boolean {
  if (!form.title?.trim()) return false
  return buildResolvedListingTitle(form).length <= LISTING_TITLE_MAX_LENGTH
}

/** Brand/model are optional; only block when free-text model exceeds the max length. */
function brandModelWithinLimits(form: SellFormValidationInput): boolean {
  const model = form.boardModelName ?? ""
  return model.length <= LISTING_BOARD_MODEL_MAX_LENGTH
}

function shapeSectionComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.category?.trim() && form.boardType?.trim())
}

function conditionComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.condition?.trim())
}

function descriptionOnlyComplete(form: SellFormValidationInput): boolean {
  return Boolean(form.description?.trim())
}

function dimensionsSectionComplete(form: SellFormValidationInput): boolean {
  const shippingRequiresLength = flagsFromBoardFulfillment(form.boardFulfillment).shipping_available
  const lenRaw = form.boardLength?.trim() ?? ""

  // Pickup-only: dimensions stay optional. Shipping: length required; width/thickness optional.
  if (!lenRaw) return !shippingRequiresLength

  const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
  if (!feetStr) return false
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return false

  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return false

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
    const shippingMode = form.boardShippingCostMode ?? "reswell"
    if (shippingMode === "free") {
      // Admin free shipping — no pack band required.
    } else if (shippingMode === "flat") {
      const raw = String(form.boardShippingPrice ?? "").trim().replace(/,/g, "")
      const n = Number.parseFloat(raw)
      if (!raw || !Number.isFinite(n) || n < 0) return false
    } else {
      // Reswell — seller-entered packed L×W×H + weight (no pack-band autofill).
      const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
      const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
      const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
      if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
      if (!isReswellPackedWeightComplete(form.reswellPackageWeightLb, form.reswellPackageWeightOz)) {
        return false
      }
    }
  }

  return true
}

function pricePublishFieldsComplete(form: SellFormValidationInput): boolean {
  const priceRaw = form.price?.trim() ?? ""
  if (!priceRaw) return false
  const price = Number.parseFloat(priceRaw.replace(/,/g, ""))
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) return false

  if (form.autoPriceDrop) {
    const floorRaw = form.autoPriceDropFloor?.trim() ?? ""
    if (!floorRaw) return false
    const floor = Number.parseFloat(floorRaw.replace(/,/g, ""))
    if (!Number.isFinite(floor) || floor < PRICE_MIN || floor > PRICE_MAX) return false
    if (floor >= price) return false
  }

  return true
}

/**
 * Per-section completion for the `/sell` board wizard stepper. Rules mirror
 * {@link validateSellListingForm} field groups so checkmarks match what’s left to publish.
 *
 * Shipping (`sell-section-shipping`): the `/sell` page may additionally require visiting the
 * shipping step + explicit `LocationPicker` confirmation before marking that step complete
 * in the rail (prefill alone cannot), unless the form already carries map coordinates from
 * draft restore / hydrate.
 */
export function computeSellSectionCompletion(
  form: SellFormValidationInput,
  opts: { imageCount: number; imagesUploadReady: boolean },
): Record<string, boolean> {
  return {
    "sell-section-product":
      titleComplete(form) &&
      brandModelWithinLimits(form) &&
      conditionComplete(form) &&
      shapeSectionComplete(form),
    "sell-section-photos":
      opts.imageCount >= LISTING_MIN_PHOTOS &&
      opts.imagesUploadReady &&
      descriptionOnlyComplete(form) &&
      dimensionsSectionComplete(form),
    "sell-section-pricing": pricePublishFieldsComplete(form),
    "sell-section-shipping": deliverySectionComplete(form),
  }
}

export interface SellStepChecklistItem {
  id: string
  label: string
  complete: boolean
  /** Wizard section this requirement belongs to (for jump-to-form from the last step). */
  sectionId: string
}

/**
 * Itemized per-section requirements for the `/sell` board wizard, using the same
 * predicates as {@link computeSellSectionCompletion} so the inline checklist can
 * never disagree with the section checkmarks or publish validation.
 */
export function computeSellStepChecklist(
  form: SellFormValidationInput,
  opts: { imageCount: number; imagesUploadReady: boolean },
): Record<string, SellStepChecklistItem[]> {
  const shippingEnabled = flagsFromBoardFulfillment(form.boardFulfillment).shipping_available

  const product: SellStepChecklistItem[] = [
    {
      id: "title",
      label: "Listing title",
      complete: titleComplete(form),
      sectionId: "sell-section-product",
    },
    {
      id: "condition",
      label: "Condition",
      complete: conditionComplete(form),
      sectionId: "sell-section-product",
    },
    {
      id: "board-type",
      label: "Board type",
      complete: shapeSectionComplete(form),
      sectionId: "sell-section-product",
    },
  ]

  const photos: SellStepChecklistItem[] = [
    {
      id: "photos",
      label:
        opts.imageCount >= LISTING_MIN_PHOTOS && !opts.imagesUploadReady
          ? "Photos (finishing upload…)"
          : `Photos (at least ${LISTING_MIN_PHOTOS})`,
      complete: opts.imageCount >= LISTING_MIN_PHOTOS && opts.imagesUploadReady,
      sectionId: "sell-section-photos",
    },
    {
      id: "dimensions",
      label: shippingEnabled ? "Dimensions (required for shipping)" : "Dimensions",
      complete: dimensionsSectionComplete(form),
      sectionId: "sell-section-photos",
    },
    {
      id: "description",
      label: "Description",
      complete: descriptionOnlyComplete(form),
      sectionId: "sell-section-photos",
    },
  ]

  const pricing: SellStepChecklistItem[] = [
    {
      id: "price",
      label: form.autoPriceDrop ? "Price and price-drop floor" : "Price",
      complete: pricePublishFieldsComplete(form),
      sectionId: "sell-section-pricing",
    },
  ]

  const locationDone = Boolean(form.locationCity?.trim() && form.locationState?.trim())
  const shipping: SellStepChecklistItem[] = [
    {
      id: "location",
      label: "Pickup location",
      complete: locationDone,
      sectionId: "sell-section-shipping",
    },
  ]
  if (shippingEnabled) {
    const shippingConfigComplete = deliverySectionComplete({
      ...form,
      locationCity: form.locationCity?.trim() ? form.locationCity : "x",
      locationState: form.locationState?.trim() ? form.locationState : "x",
    })
    shipping.push({
      id: "shipping-setup",
      label: "Package size and weight",
      complete: shippingConfigComplete,
      sectionId: "sell-section-shipping",
    })
  }

  return {
    "sell-section-product": product,
    "sell-section-photos": photos,
    "sell-section-pricing": pricing,
    "sell-section-shipping": shipping,
  }
}
