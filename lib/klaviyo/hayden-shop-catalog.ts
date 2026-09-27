/**
 * Klaviyo catalog category for active surfboards in Hayden Garfield’s shop.
 * Product feeds filter on this name (Content → Products → Product feeds).
 */
export const KLAVIYO_HAYDEN_SHOP_CATEGORY = "Hayden Garfields Shop"

/** Profile email for Hayden Garfield’s seller shop when no user-id env is set. */
export const KLAVIYO_HAYDEN_SHOP_SELLER_EMAIL = "haydensbsb@gmail.com"

/**
 * Category to add on a catalog row, or null when the listing is not one of Hayden’s surfboards.
 */
export function klaviyoHaydenShopCategoryForListing(
  listing: {
    user_id?: string | null
    section?: string | null
  },
  haydenShopUserId: string | null | undefined,
): string | null {
  const haydenId = haydenShopUserId?.trim()
  if (!haydenId) return null
  const ownerId = typeof listing.user_id === "string" ? listing.user_id.trim() : ""
  if (!ownerId || ownerId !== haydenId) return null
  if (listing.section?.trim() !== "surfboards") return null
  return KLAVIYO_HAYDEN_SHOP_CATEGORY
}
