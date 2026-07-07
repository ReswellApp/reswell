import {
  MAGAZINES_SECTION,
  MAGAZINE_LISTING_DEFAULT_LOCATION,
  USED_MAGAZINES_CATEGORY_ID,
} from "@/lib/magazine-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import type { CreateMagazineListingInput } from "@/lib/validations/magazine-listing"

function magazineListingShippingFieldsFor(input: CreateMagazineListingInput): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  const mode = input.shippingCostMode ?? "reswell"
  if (mode === "free") {
    return {
      shipping_available: true,
      local_pickup: false,
      shipping_price: 0,
      board_shipping_cost_mode: "free",
    }
  }
  if (mode === "reswell") {
    return {
      shipping_available: true,
      local_pickup: false,
      shipping_price: 0,
      board_shipping_cost_mode: "reswell",
    }
  }
  return {
    shipping_available: true,
    local_pickup: false,
    shipping_price: input.shippingPrice ?? 0,
    board_shipping_cost_mode: "flat",
  }
}

/** Maps validated sell-form input to `listings` columns for create/update. */
export function buildMagazineListingPersistFields(
  input: CreateMagazineListingInput,
): Record<string, unknown> {
  const shipping = magazineListingShippingFieldsFor(input)
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: input.shippingCostMode ?? "reswell",
    reswellPackageLengthIn: input.reswellPackageLengthIn,
    reswellPackageWidthIn: input.reswellPackageWidthIn,
    reswellPackageHeightIn: input.reswellPackageHeightIn,
    reswellPackageWeightLb: input.reswellPackageWeightLb,
    reswellPackageWeightOz: input.reswellPackageWeightOz,
  })

  const brand = input.brand.trim()

  return {
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.price,
    condition: input.condition,
    section: MAGAZINES_SECTION,
    category_id: USED_MAGAZINES_CATEGORY_ID,
    latitude: MAGAZINE_LISTING_DEFAULT_LOCATION.latitude,
    longitude: MAGAZINE_LISTING_DEFAULT_LOCATION.longitude,
    city: MAGAZINE_LISTING_DEFAULT_LOCATION.city,
    state: MAGAZINE_LISTING_DEFAULT_LOCATION.state,
    ...shipping,
    ...packedRow,
    buyer_offers_enabled: false,
    seller_purchase_price_usd: null,
    brand,
    brand_id: null,
    model: null,
    brand_model_id: null,
    magazine_year: input.year,
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
