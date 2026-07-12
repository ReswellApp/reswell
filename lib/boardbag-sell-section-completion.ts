import { BOARDBAG_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/boardbag-listing"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  isReswellPackedWeightComplete,
} from "@/lib/reswell-parcel-fields"

export type BoardbagSellSectionCompletionInput = {
  title: string
  readyPhotoCount: number
  condition: string
  description: string
  locationCity: string
  locationState: string
  shippingAvailable: boolean
  localPickup: boolean
  shippingMode: "reswell" | "free" | "flat"
  shippingPrice: string
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
  price: string
}

function reswellPackageComplete(form: BoardbagSellSectionCompletionInput): boolean {
  const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
  return isReswellPackedWeightComplete(form.reswellPackageWeightLb, form.reswellPackageWeightOz)
}

export function computeBoardbagSellSectionCompletion(
  form: BoardbagSellSectionCompletionInput,
): Record<string, boolean> {
  const titleOk =
    form.title.trim().length > 0 && form.title.trim().length <= BOARDBAG_LISTING_TITLE_MAX_LENGTH
  const photosTitle = titleOk && form.readyPhotoCount > 0

  const details = Boolean(form.condition.trim()) && Boolean(form.description.trim())

  const hasDelivery = form.shippingAvailable || form.localPickup
  const shippingRateOk =
    !form.shippingAvailable ||
    form.shippingMode === "free" ||
    (form.shippingMode === "flat" && Number(form.shippingPrice) >= 0 && form.shippingPrice !== "") ||
    (form.shippingMode === "reswell" && reswellPackageComplete(form))
  const delivery =
    Boolean(form.locationCity.trim() && form.locationState.trim()) &&
    hasDelivery &&
    shippingRateOk

  const priceNum = Number.parseFloat(form.price)
  const publish = Number.isFinite(priceNum) && priceNum > 0

  return {
    "sell-boardbags-section-photos-title": photosTitle,
    "sell-boardbags-section-details": details,
    "sell-boardbags-section-delivery": delivery,
    "sell-boardbags-section-publish": publish,
  }
}
