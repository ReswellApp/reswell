import {
  BOARDBAGS_SECTION,
  USED_BOARDBAGS_CATEGORY_ID,
  boardbagSizeSlugForDb,
} from "@/lib/boardbag-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import type { CreateBoardbagListingInput } from "@/lib/validations/boardbag-listing"

export function boardbagListingShippingFieldsFor(input: CreateBoardbagListingInput): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  if (!input.shippingAvailable) {
    return {
      shipping_available: false,
      local_pickup: true,
      shipping_price: null,
      board_shipping_cost_mode: null,
    }
  }
  const mode = input.shippingCostMode ?? "reswell"
  if (mode === "free") {
    return {
      shipping_available: true,
      local_pickup: input.localPickup,
      shipping_price: 0,
      board_shipping_cost_mode: "free",
    }
  }
  if (mode === "reswell") {
    return {
      shipping_available: true,
      local_pickup: input.localPickup,
      shipping_price: 0,
      board_shipping_cost_mode: "reswell",
    }
  }
  return {
    shipping_available: true,
    local_pickup: input.localPickup,
    shipping_price: input.shippingPrice ?? 0,
    board_shipping_cost_mode: "flat",
  }
}

/** Maps validated sell-form input to `listings` columns for create/update. */
export function buildBoardbagListingPersistFields(
  input: CreateBoardbagListingInput,
): Record<string, unknown> {
  const shipping = boardbagListingShippingFieldsFor(input)
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: input.shippingCostMode ?? "reswell",
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
    section: BOARDBAGS_SECTION,
    category_id: USED_BOARDBAGS_CATEGORY_ID,
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
    boardbag_size: boardbagSizeSlugForDb(input.size ?? null),
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
