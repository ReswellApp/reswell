/**
 * Reswell shop (`section = new`) ships only — packed box is set per product for ShipEngine quotes.
 */

export const RESWELL_SHOP_DEFAULT_LOCATION = {
  city: "Santa Barbara",
  state: "CA",
  latitude: 34.4208,
  longitude: -119.6982,
} as const

/** Default packed parcel prefilled on new product forms. */
export const RESWELL_SHOP_DEFAULT_PACKAGE = {
  lengthIn: 14,
  widthIn: 10,
  heightIn: 6,
  weightLb: 2,
} as const

export type ReswellShopPackageInches = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}

export function normalizeReswellShopPackage(input: {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
}): ReswellShopPackageInches | null {
  const lengthIn = Number(input.lengthIn)
  const widthIn = Number(input.widthIn)
  const heightIn = Number(input.heightIn)
  const weightLb = Number(input.weightLb)
  if (
    ![lengthIn, widthIn, heightIn, weightLb].every((n) => Number.isFinite(n) && n > 0) ||
    lengthIn > 108 ||
    widthIn > 108 ||
    heightIn > 108 ||
    weightLb > 150
  ) {
    return null
  }
  return {
    lengthIn: Math.round(lengthIn * 100) / 100,
    widthIn: Math.round(widthIn * 100) / 100,
    heightIn: Math.round(heightIn * 100) / 100,
    weightLb: Math.round(weightLb * 100) / 100,
  }
}

/** Listing columns for Reswell shop shipping (shipping-only + per-product box). */
export function reswellShopShippingPersistFields(pkg: ReswellShopPackageInches): Record<string, unknown> {
  return {
    shipping_available: true,
    local_pickup: false,
    shipping_price: null,
    board_shipping_cost_mode: "reswell",
    shipping_packed_length_in: pkg.lengthIn,
    shipping_packed_width_in: pkg.widthIn,
    shipping_packed_height_in: pkg.heightIn,
    shipping_packed_weight_oz: Math.round(pkg.weightLb * 16 * 100) / 100,
    shipping_package_tier: null,
    shipping_package_band: null,
    city: RESWELL_SHOP_DEFAULT_LOCATION.city,
    state: RESWELL_SHOP_DEFAULT_LOCATION.state,
    latitude: RESWELL_SHOP_DEFAULT_LOCATION.latitude,
    longitude: RESWELL_SHOP_DEFAULT_LOCATION.longitude,
  }
}
