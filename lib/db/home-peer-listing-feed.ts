import { hydrateCardListingImages } from "@/lib/listing-image-display"

/**
 * Shared homepage / PDP peer listing payloads.
 * Cover image uses denormalized `primary_*` columns — no `listing_images` join.
 * Call {@link hydrateHomePeerListingRows} after fetch so card UIs still receive
 * a synthetic `listing_images` array.
 */
export const HOME_PEER_LISTING_WITH_PROFILE_SELECT = `
  *,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name)
`

/** Attach card `listing_images` from denormalized primary_* fields. */
export function hydrateHomePeerListingRows<T extends Record<string, unknown>>(
  rows: T[] | null | undefined,
) {
  return hydrateCardListingImages(rows ?? [])
}
