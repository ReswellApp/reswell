/**
 * Magazines marketplace — `listings` rows with `section = 'magazines'`.
 */

export const MAGAZINES_SECTION = "magazines" as const

/** Fixed `categories.id` — must match `20260707120000_magazines_marketplace.sql`. */
export const USED_MAGAZINES_CATEGORY_ID = "f1115a1e-aaaa-4bbb-8ccc-000000000008"

/** Profile that owns every magazine listing on the public marketplace (not the Reswell shop account). */
export const MAGAZINE_LISTING_SELLER_EMAIL = "haydensbsb@gmail.com"

/** Default ship-from location for admin magazine listings (Reswell fulfillment). */
export const MAGAZINE_LISTING_DEFAULT_LOCATION = {
  city: "Santa Barbara",
  state: "CA",
  latitude: 34.4208,
  longitude: -119.6982,
} as const
