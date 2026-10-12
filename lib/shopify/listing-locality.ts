export interface ShopifyMerchantProfileLocality {
  default_listing_city?: string | null
  default_listing_state?: string | null
  city?: string | null
  location?: string | null
}

export function resolveShopifyListingLocality(
  profile: ShopifyMerchantProfileLocality | null,
): { city: string; state: string } {
  return {
    city:
      profile?.default_listing_city?.trim() ||
      profile?.city?.trim() ||
      profile?.location?.trim() ||
      "United States",
    state: profile?.default_listing_state?.trim() || "US",
  }
}
