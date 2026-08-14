import { MAGAZINES_SECTION, USED_MAGAZINES_CATEGORY_ID } from "@/lib/magazine-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import type { CreateMagazineListingInput } from "@/lib/validations/magazine-listing"

function magazineListingShippingFieldsFor(_input: CreateMagazineListingInput): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  return {
    shipping_available: true,
    local_pickup: false,
    shipping_price: 0,
    board_shipping_cost_mode: "reswell",
  }
}

/** Maps validated sell-form input to `listings` columns for create/update. */
export function buildMagazineListingPersistFields(
  input: CreateMagazineListingInput,
): Record<string, unknown> {
  const shipping = magazineListingShippingFieldsFor(input)
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: "reswell",
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
    latitude: input.locationLat ?? null,
    longitude: input.locationLng ?? null,
    city: input.locationCity.trim(),
    state: input.locationState.trim(),
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
