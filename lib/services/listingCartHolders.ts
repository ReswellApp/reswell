import type { SupabaseClient } from "@supabase/supabase-js"
import { getListingCartHoldersForSeller } from "@/lib/db/listing-cart-holders"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { ListingCartHolder } from "@/lib/types/listing-cart-holders"

export type ListListingCartHoldersResult =
  | { ok: true; holders: ListingCartHolder[] }
  | { ok: false; status: number; error: string }

export async function listListingCartHoldersForSeller(
  supabase: SupabaseClient,
  sellerUserId: string,
  listingId: string,
): Promise<ListListingCartHoldersResult> {
  const { data: listing, error } = await supabase
    .from("listings")
    .select("id, user_id, section, status, hidden_from_site")
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    console.error("[listListingCartHoldersForSeller]", error.message)
    return { ok: false, status: 500, error: "Could not load cart buyers." }
  }

  if (!listing || listing.user_id !== sellerUserId) {
    return { ok: false, status: 404, error: "Listing not found." }
  }

  if (!isPeerListingSection(listing.section)) {
    return { ok: false, status: 400, error: "Offers are not available for this listing type." }
  }

  if (listing.hidden_from_site === true || listing.status === "sold" || listing.status === "draft") {
    return { ok: false, status: 400, error: "This listing is not accepting offers right now." }
  }

  try {
    const holders = await getListingCartHoldersForSeller(supabase, listingId)
    return { ok: true, holders }
  } catch (e) {
    console.error("[listListingCartHoldersForSeller]", e)
    return { ok: false, status: 500, error: "Could not load cart buyers." }
  }
}
