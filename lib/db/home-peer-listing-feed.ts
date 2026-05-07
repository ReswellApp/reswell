/** Shared homepage peer listing payloads (recent surfboards / shortboards strips). Keep in sync with {@link fetchHomeFeaturedPeerListings}. */
export const HOME_PEER_LISTING_WITH_PROFILE_SELECT = `
  *,
  listing_images (url, thumbnail_url, sort_order, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name)
`
