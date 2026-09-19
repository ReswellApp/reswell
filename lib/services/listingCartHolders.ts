import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getListingCartHoldersForAdmin,
  getListingCartHoldersForSeller,
} from "@/lib/db/listing-cart-holders"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { ListingAdminCartHolder, ListingCartHolder } from "@/lib/types/listing-cart-holders"

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

/** Admin PDP bar — identities of buyers who currently have this listing in cart. */
export async function listListingCartHoldersForAdmin(
  listingId: string,
): Promise<ListingAdminCartHolder[]> {
  const id = listingId.trim()
  if (!id) return []

  try {
    const service = createServiceRoleClient()
    return await getListingCartHoldersForAdmin(service, id)
  } catch (e) {
    console.error("[listListingCartHoldersForAdmin]", e)
    return []
  }
}
