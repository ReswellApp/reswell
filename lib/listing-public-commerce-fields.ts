export type ListingPublicCommerceFields = {
  price: number
  compare_at_price: string | number | null
  status: string | null
}

export function applyListingPublicCommerceFields<T extends Record<string, unknown>>(
  listing: T,
  live: ListingPublicCommerceFields,
): T {
  return {
    ...listing,
    price: live.price,
    compare_at_price: live.compare_at_price,
    status: live.status ?? listing.status,
  }
}
