import type { MobileListingCard } from "@reswell/api-contract"

/** Same peer sections as `lib/cart-eligibility` / website listing tiles. */
export const LISTING_CART_PEER_SECTIONS = new Set([
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
  "magazines",
  "traction",
])

/** When to show the bag on a tile — mirrors server cart rules at a high level. */
export function canShowListingCartButton(
  item: MobileListingCard,
  options?: { badge?: string; viewerId?: string | null },
): boolean {
  if (options?.badge) return false
  if (!LISTING_CART_PEER_SECTIONS.has(item.section)) return false
  const localPickup = item.local_pickup !== false
  const shipping = Boolean(item.shipping_available)
  if (!localPickup && !shipping) return false
  if (options?.viewerId && item.seller?.id === options.viewerId) return false
  return true
}
