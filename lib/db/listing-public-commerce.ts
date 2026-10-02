import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingPublicCommerceFields } from "@/lib/listing-public-commerce-fields"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"

export type { ListingPublicCommerceFields }

/** Live list price, compare-at, and status — not the hourly `/l` row cache. */
export async function fetchListingPublicCommerceFields(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingPublicCommerceFields | null> {
  const id = listingId.trim()
  if (!id) return null

  const { data, error } = await supabase
    .from("listings")
    .select("price, compare_at_price, status")
    .eq("id", id)
    .maybeSingle()

  if (error || !data) return null

  const row = data as {
    price?: string | number | null
    compare_at_price?: string | number | null
    status?: string | null
  }

  return {
    price: publicListingListPriceUsd(row.price),
    compare_at_price: row.compare_at_price ?? null,
    status: typeof row.status === "string" ? row.status : null,
  }
}
