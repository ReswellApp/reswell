import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingCartHolder } from "@/lib/types/listing-cart-holders"

/** Buyers with this listing saved in cart (peer listings; excludes ineligible listing states). */
export async function getListingCartHolderCount(
  supabase: SupabaseClient,
  listingId: string,
): Promise<number> {
  const { data, error } = await supabase.rpc("count_listing_cart_holders", {
    p_listing_id: listingId,
  })
  if (error) {
    console.error("count_listing_cart_holders:", error.message)
    return 0
  }
  if (data == null) return 0
  return typeof data === "number" ? data : Number(data) || 0
}

type ListingCartHolderRpcRow = {
  buyer_id: string
  display_name: string | null
  shop_name: string | null
  is_shop: boolean | null
  avatar_url: string | null
  added_at: string
  open_offer_id: string | null
  conversation_id: string | null
}

function cartHolderDisplayName(row: ListingCartHolderRpcRow): string {
  if (row.is_shop && row.shop_name?.trim()) return row.shop_name.trim()
  return row.display_name?.trim() || "Member"
}

/** Listing owner only — identities of buyers who currently have this listing in cart. */
export async function getListingCartHoldersForSeller(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingCartHolder[]> {
  const { data, error } = await supabase.rpc("list_listing_cart_holders", {
    p_listing_id: listingId,
  })
  if (error) {
    console.error("list_listing_cart_holders:", error.message)
    throw new Error("Could not load buyers with this listing in their cart.")
  }

  const rows = Array.isArray(data) ? data : []
  const holders: ListingCartHolder[] = []
  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue
    const row = raw as ListingCartHolderRpcRow
    if (typeof row.buyer_id !== "string") continue
    holders.push({
      buyerUserId: row.buyer_id,
      displayName: cartHolderDisplayName(row),
      avatarUrl: typeof row.avatar_url === "string" && row.avatar_url.trim() ? row.avatar_url : null,
      addedAt: typeof row.added_at === "string" ? row.added_at : new Date().toISOString(),
      openOfferId: typeof row.open_offer_id === "string" ? row.open_offer_id : null,
      conversationId: typeof row.conversation_id === "string" ? row.conversation_id : null,
    })
  }
  return holders
}
