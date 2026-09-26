import {
  TRACTION_SECTION,
  USED_TRACTION_CATEGORY_ID,
  tractionSizeSlugForDb,
} from "@/lib/traction-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import type { ListingPersistShippingOptions } from "@/lib/sell-shipping-cost-mode"
import type { CreateTractionListingInput } from "@/lib/validations/traction-listing"

export function tractionListingShippingFieldsFor(
  input: CreateTractionListingInput,
  options?: ListingPersistShippingOptions,
): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  const mode = normalizeSellShippingCostMode(
    input.shippingCostMode,
    options?.allowPrivilegedShippingModes === true,
  )
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
export function buildTractionListingPersistFields(
  input: CreateTractionListingInput,
  options?: ListingPersistShippingOptions,
): Record<string, unknown> {
  const shipping = tractionListingShippingFieldsFor(input, options)
  const shippingMode = normalizeSellShippingCostMode(
    input.shippingCostMode,
    options?.allowPrivilegedShippingModes === true,
  )
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: shippingMode,
    reswellPackageLengthIn: input.reswellPackageLengthIn,
    reswellPackageWidthIn: input.reswellPackageWidthIn,
    reswellPackageHeightIn: input.reswellPackageHeightIn,
    reswellPackageWeightLb: input.reswellPackageWeightLb,
    reswellPackageWeightOz: input.reswellPackageWeightOz,
  })

  const brand = input.brand?.trim() || null
  const brandId = input.brandId?.trim() || null
  const model = input.model?.trim() || null
  const brandModelId = input.brandModelId?.trim() || null

  return {
    title: input.title.trim(),
    description: input.description.trim(),
    price: input.price,
    condition: input.condition,
    section: TRACTION_SECTION,
    category_id: USED_TRACTION_CATEGORY_ID,
    latitude: input.locationLat ?? null,
    longitude: input.locationLng ?? null,
    city: input.locationCity.trim(),
    state: input.locationState.trim(),
    ...shipping,
    ...packedRow,
    buyer_offers_enabled: input.buyerOffers !== false,
    seller_purchase_price_usd: input.sellerPurchasePrice ?? null,
    brand,
    brand_id: brandId,
    model,
    brand_model_id: brandModelId,
    traction_size: tractionSizeSlugForDb(input.size ?? null),
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
