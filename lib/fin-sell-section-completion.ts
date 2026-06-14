import { FIN_LISTING_TITLE_MAX_LENGTH } from "@/lib/validations/fin-listing"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"

export type FinSellSectionCompletionInput = {
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

function reswellPackageComplete(form: FinSellSectionCompletionInput): boolean {
  const L = parseReswellParcelLengthRawToCarrierInches(form.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(form.reswellPackageHeightIn)
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false

  const lbRaw = form.reswellPackageWeightLb?.trim() ?? ""
  const ozRaw = form.reswellPackageWeightOz?.trim() ?? ""
  if (lbRaw === "" && ozRaw === "") return true

  const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
  const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) return false
  const totalOz = lb * 16 + oz
  return Number.isFinite(totalOz) && totalOz > 0
}

export function computeFinSellSectionCompletion(
  form: FinSellSectionCompletionInput,
): Record<string, boolean> {
  const titleOk =
    form.title.trim().length > 0 && form.title.trim().length <= FIN_LISTING_TITLE_MAX_LENGTH
  const photosTitle = titleOk && form.readyPhotoCount > 0

  const details =
    Boolean(form.condition.trim()) && Boolean(form.description.trim())

  const shippingRateOk =
    form.shippingMode === "free" ||
    (form.shippingMode === "flat" && Number(form.shippingPrice) >= 0 && form.shippingPrice !== "") ||
    (form.shippingMode === "reswell" && reswellPackageComplete(form))
  const delivery =
    Boolean(form.locationCity.trim() && form.locationState.trim()) &&
    form.shippingAvailable &&
    shippingRateOk

  const priceNum = Number.parseFloat(form.price)
  const publish = Number.isFinite(priceNum) && priceNum > 0

  return {
    "sell-fins-section-photos-title": photosTitle,
    "sell-fins-section-details": details,
    "sell-fins-section-delivery": delivery,
    "sell-fins-section-publish": publish,
  }
}
