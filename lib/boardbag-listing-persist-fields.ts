import {
  BOARDBAGS_SECTION,
  USED_BOARDBAGS_CATEGORY_ID,
  boardbagSizeSlugForDb,
} from "@/lib/boardbag-listing-config"
import { stockQuantityForSellCondition } from "@/lib/listing-stock-quantity"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import { normalizeSellShippingCostMode } from "@/lib/sell-shipping-cost-mode"
import type { ListingPersistShippingOptions } from "@/lib/sell-shipping-cost-mode"
import { shipOnlyListingShippingFieldsFor } from "@/lib/sell-ship-only-listing-shipping"
import type { CreateBoardbagListingInput } from "@/lib/validations/boardbag-listing"

export function boardbagListingShippingFieldsFor(
  input: CreateBoardbagListingInput,
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
export function buildBoardbagListingPersistFields(
  input: CreateBoardbagListingInput,
  options?: ListingPersistShippingOptions,
): Record<string, unknown> {
  const shipping = boardbagListingShippingFieldsFor(input, options)
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
    seller_purchased_from: input.sellerPurchasedFrom?.trim() || null,
    seller_purchased_on: input.sellerPurchasedOn || null,
    brand,
    brand_id: brandId,
    model,
    brand_model_id: brandModelId,
    boardbag_size: boardbagSizeSlugForDb(input.size ?? null),
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
