import {
  applyFinReswellPackageDefaults,
  finReswellPackageHasPartialDimensions,
} from "@/lib/fin-reswell-shipping-defaults"
import { RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN } from "@/lib/surfboard-shipping-estimates"
import { isListingSellableCondition } from "@/lib/listing-labels"
import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
} from "@/lib/reswell-parcel-fields"
import {
  FIN_LISTING_MAX_PHOTOS,
  FIN_LISTING_MIN_PHOTOS,
  FIN_LISTING_TITLE_MAX_LENGTH,
} from "@/lib/validations/fin-listing"
import type { ListingPhotoSlot } from "@/lib/sell-flow/listing-photo-slot"
import { listingPhotosUploadReady } from "@/lib/sell-flow/listing-photo-slot"

export type FinSellFormValidationInput = {
  title: string
  description: string
  price: string
  condition: string
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
}

const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export function validateFinListingForm(
  form: FinSellFormValidationInput,
  opts: {
    imageCount: number
    imagesUploadReady: boolean
  },
): string | null {
  if (!form.title.trim()) {
    return "Please enter a listing title."
  }
  if (form.title.trim().length > FIN_LISTING_TITLE_MAX_LENGTH) {
    return `Title must be ${FIN_LISTING_TITLE_MAX_LENGTH} characters or fewer.`
  }

  if (opts.imageCount < FIN_LISTING_MIN_PHOTOS) {
    return "Add at least one photo."
  }
  if (!opts.imagesUploadReady) {
    return "Hang tight — your photos are still uploading."
  }

  if (!form.condition) {
    return "Please select a condition."
  }
  if (!isListingSellableCondition(form.condition)) {
    return "Please select a condition."
  }

  if (!form.description.trim()) {
    return "Add a description."
  }

  if (!form.price.trim()) {
    return "Enter a listing price."
  }
  const price = Number.parseFloat(form.price.trim())
  if (!Number.isFinite(price) || price < PRICE_MIN || price > PRICE_MAX) {
    return `Enter a valid price between $${PRICE_MIN} and $${PRICE_MAX.toLocaleString()}.`
  }

  if (!form.locationCity.trim() || !form.locationState.trim()) {
    return "Confirm where you're shipping from."
  }

  if (!form.shippingAvailable || form.localPickup) {
    return "Fin listings must ship — local pickup is not available."
  }

  if (form.shippingMode === "flat") {
    if (form.shippingPrice === "" || Number(form.shippingPrice) < 0) {
      return "Enter a flat shipping rate."
    }
  }

  if (form.shippingMode === "reswell") {
    if (finReswellPackageHasPartialDimensions(form)) {
      return "Enter all packed box dimensions, or leave them all blank to use our fin defaults."
    }
    const resolved = applyFinReswellPackageDefaults(form)
    const L = parseReswellParcelLengthRawToCarrierInches(resolved.reswellPackageLengthIn)
    const W = parseReswellParcelWidthHeightRawToCarrierInches(resolved.reswellPackageWidthIn)
    const H = parseReswellParcelWidthHeightRawToCarrierInches(resolved.reswellPackageHeightIn)
    if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) {
      return "Enter packed box dimensions for Reswell shipping."
    }
    if (L > RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN) {
      return `Packed length for fins must be ${RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN} inches or less.`
    }
  }

  return null
}

export function finListingImagesUploadReady(images: ListingPhotoSlot[]): boolean {
  return listingPhotosUploadReady(images)
}

export const FIN_LISTING_PHOTO_MAX = FIN_LISTING_MAX_PHOTOS
