import { fetchListingPublicCommerceFields } from "@/lib/db/listing-public-commerce"
import { applyListingPublicCommerceFields } from "@/lib/listing-public-commerce-fields"
import { getDb } from "@/lib/supabase/db"

export { applyListingPublicCommerceFields } from "@/lib/listing-public-commerce-fields"

/**
 * Replace cached `price` / `compare_at_price` / `status` with a primary DB read.
 * Used when `/l` regenerates so a stale hourly listing row cannot bake the
 * wrong buy price (shop tiles query `listings.price` separately).
 */
export async function overlayListingPublicCommerceFields<T extends Record<string, unknown>>(
  listing: T,
): Promise<T>
export async function overlayListingPublicCommerceFields<T extends Record<string, unknown>>(
  listing: T | null,
): Promise<T | null>
export async function overlayListingPublicCommerceFields<T extends Record<string, unknown>>(
  listing: T | null,
): Promise<T | null> {
  if (!listing) return null
  const listingId = typeof listing.id === "string" ? listing.id : ""
  if (!listingId) return listing

  try {
    const live = await fetchListingPublicCommerceFields(
      getDb({ consistency: "strong" }),
      listingId,
    )
    if (!live) return listing
    return applyListingPublicCommerceFields(listing, live)
  } catch (error) {
    console.error("[listing-public-commerce] overlay failed", error)
    return listing
  }
}
