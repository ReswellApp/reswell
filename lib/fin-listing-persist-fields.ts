import { applyFinReswellPackageDefaults } from "@/lib/fin-reswell-shipping-defaults"
import { finsSetupFieldForDb } from "@/lib/listing-facet-write"
import {
  FINS_SECTION,
  USED_FINS_CATEGORY_ID,
  finSystemSlugForDb,
  finSizeSlugForDb,
} from "@/lib/fin-listing-config"
import { reswellPackageFieldsToDb } from "@/lib/sell-listing-fulfillment-flags"
import type { CreateFinListingInput } from "@/lib/validations/fin-listing"

export function finListingShippingFieldsFor(input: CreateFinListingInput): {
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
export function buildFinListingPersistFields(input: CreateFinListingInput): Record<string, unknown> {
  const shipping = finListingShippingFieldsFor(input)
  const shippingMode = input.shippingCostMode ?? "reswell"
  const reswellPackage =
    shippingMode === "reswell"
      ? applyFinReswellPackageDefaults({
          reswellPackageLengthIn: input.reswellPackageLengthIn ?? "",
          reswellPackageWidthIn: input.reswellPackageWidthIn ?? "",
          reswellPackageHeightIn: input.reswellPackageHeightIn ?? "",
          reswellPackageWeightLb: input.reswellPackageWeightLb ?? "",
          reswellPackageWeightOz: input.reswellPackageWeightOz ?? "",
        })
      : {
          reswellPackageLengthIn: input.reswellPackageLengthIn ?? "",
          reswellPackageWidthIn: input.reswellPackageWidthIn ?? "",
          reswellPackageHeightIn: input.reswellPackageHeightIn ?? "",
          reswellPackageWeightLb: input.reswellPackageWeightLb ?? "",
          reswellPackageWeightOz: input.reswellPackageWeightOz ?? "",
        }
  const packedRow = reswellPackageFieldsToDb({
    boardShippingCostMode: shippingMode,
    ...reswellPackage,
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
    section: FINS_SECTION,
    category_id: USED_FINS_CATEGORY_ID,
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
    fins_setup: finsSetupFieldForDb(input.finSetup ?? undefined),
    fin_system: finSystemSlugForDb(input.finSystem ?? null),
    fin_size: finSizeSlugForDb(input.size ?? null),
    board_type: null,
    updated_at: new Date().toISOString(),
  }
}
