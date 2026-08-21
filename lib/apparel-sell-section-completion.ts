import { APPAREL_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/apparel-listing"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  isReswellPackedWeightComplete,
} from "@/lib/reswell-parcel-fields"

export type ApparelSellSectionCompletionInput = {
  title: string
  readyPhotoCount: number
  kind: string
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

function reswellPackageComplete(form: ApparelSellSectionCompletionInput): boolean {
  const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
  return isReswellPackedWeightComplete(form.reswellPackageWeightLb, form.reswellPackageWeightOz)
}

export function computeApparelSellSectionCompletion(
  form: ApparelSellSectionCompletionInput,
): Record<string, boolean> {
  const titleOk =
    form.title.trim().length > 0 && form.title.trim().length <= APPAREL_LISTING_TITLE_MAX_LENGTH
  const photosTitle = titleOk && form.readyPhotoCount > 0

  const details =
    Boolean(form.kind.trim()) &&
    Boolean(form.condition.trim()) &&
    Boolean(form.description.trim())

  const hasDelivery = form.shippingAvailable || form.localPickup
  const shippingRateOk = !form.shippingAvailable || reswellPackageComplete(form)
  const delivery =
    Boolean(form.locationCity.trim() && form.locationState.trim()) &&
    hasDelivery &&
    shippingRateOk

  const priceNum = Number.parseFloat(form.price)
  const publish = Number.isFinite(priceNum) && priceNum > 0

  return {
    "sell-apparel-section-photos-title": photosTitle,
    "sell-apparel-section-details": details,
    "sell-apparel-section-delivery": delivery,
    "sell-apparel-section-publish": publish,
  }
}
