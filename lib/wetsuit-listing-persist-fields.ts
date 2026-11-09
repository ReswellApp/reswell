import {
  WETSUITS_SECTION,
  USED_WETSUITS_CATEGORY_ID,
  wetsuitSizeSlugForDb,
} from "@/lib/wetsuit-listing-config"
import { stockQuantityForSellCondition } from "@/lib/listing-stock-quantity"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import type { ListingPersistShippingOptions } from "@/lib/sell-shipping-cost-mode"
import { shipOnlyListingShippingFieldsFor } from "@/lib/sell-ship-only-listing-shipping"
import type { CreateWetsuitListingInput } from "@/lib/validations/wetsuit-listing"

export function wetsuitListingShippingFieldsFor(
  input: CreateWetsuitListingInput,
  options?: ListingPersistShippingOptions,
): {
  shipping_available: boolean
  local_pickup: boolean
  shipping_price: number | null
  board_shipping_cost_mode: string | null
} {
  return shipOnlyListingShippingFieldsFor(
    {
      shippingCostMode: input.shippingCostMode,
      shippingPrice: input.shippingPrice,
    },
    options,
  )
}

/** Maps validated sell-form input to `listings` columns for create/update. */
export function buildWetsuitListingPersistFields(
  input: CreateWetsuitListingInput,
  options?: ListingPersistShippingOptions,
): Record<string, unknown> {
  const shipping = wetsuitListingShippingFieldsFor(input, options)
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
    stock_quantity: stockQuantityForSellCondition(input.condition, input.stockQuantity),
    section: WETSUITS_SECTION,
    category_id: USED_WETSUITS_CATEGORY_ID,
    latitude: input.locationLat ?? null,
    longitude: input.locationLng ?? null,
    city: input.locationCity.trim(),
    state: input.locationState.trim(),
    ...shipping,
    ...packedRow,
    buyer_offers_enabled: input.buyerOffers !== false,
    seller_purchase_price_usd: input.sellerPurchasePrice ?? null,
    seller_purchased_from: input.sellerPurchasedFrom?.trim() || null,
    seller_purchased_on: input.sellerPurchasedOn || null,
    brand,
    brand_id: brandId,
    model,
    brand_model_id: brandModelId,
    wetsuit_size: wetsuitSizeSlugForDb(input.size ?? null),
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
