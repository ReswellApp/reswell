/**
 * Public seller profile URL uses `profiles.seller_slug` (unique, URL-safe).
 */

export type SellerSlugPick = {
  seller_slug?: string | null
}

export function sellerProfileHref(profile: SellerSlugPick | null | undefined): string {
  const s = profile?.seller_slug?.trim()
  if (!s) return "/sellers"
  return `/sellers/${s}`
}
