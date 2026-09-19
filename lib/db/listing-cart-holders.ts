import type { SupabaseClient } from "@supabase/supabase-js"
import { listingAdminCartHolderFromSource } from "@/lib/listing-detail-admin-bar"
import type { ListingAdminCartHolder, ListingCartHolder } from "@/lib/types/listing-cart-holders"

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

type AdminCartItemRow = {
  profile_id: unknown
  quantity?: unknown
  created_at?: unknown
}

type AdminCartProfileRow = {
  id: unknown
  email?: unknown
  display_name?: unknown
  shop_name?: unknown
  is_shop?: unknown
  avatar_url?: unknown
}

/** Service-role only — every buyer currently holding this listing in cart. */
export async function getListingCartHoldersForAdmin(
  serviceSupabase: SupabaseClient,
  listingId: string,
): Promise<ListingAdminCartHolder[]> {
  const id = listingId.trim()
  if (!id) return []

  const { data: cartRows, error: cartError } = await serviceSupabase
    .from("cart_items")
    .select("profile_id, quantity, created_at")
    .eq("listing_id", id)
    .order("created_at", { ascending: false })
    .limit(100)

  if (cartError) {
    console.error("getListingCartHoldersForAdmin cart_items:", cartError.message)
    return []
  }

  const items = Array.isArray(cartRows) ? (cartRows as AdminCartItemRow[]) : []
  const profileIds = [
    ...new Set(
      items
        .map((row) => (typeof row.profile_id === "string" ? row.profile_id.trim() : ""))
        .filter((profileId) => profileId.length > 0),
    ),
  ]
  if (profileIds.length === 0) return []

  const { data: profileRows, error: profileError } = await serviceSupabase
    .from("profiles")
    .select("id, email, display_name, shop_name, is_shop, avatar_url")
    .in("id", profileIds)

  if (profileError) {
    console.error("getListingCartHoldersForAdmin profiles:", profileError.message)
  }

  const profilesById = new Map<string, AdminCartProfileRow>()
  for (const raw of Array.isArray(profileRows) ? profileRows : []) {
    if (!raw || typeof raw !== "object") continue
    const row = raw as AdminCartProfileRow
    if (typeof row.id !== "string" || !row.id.trim()) continue
    profilesById.set(row.id, row)
  }

  const holders: ListingAdminCartHolder[] = []
  for (const item of items) {
    const profileId = typeof item.profile_id === "string" ? item.profile_id : ""
    const profile = profilesById.get(profileId)
    const holder = listingAdminCartHolderFromSource({
      profileId,
      quantity: item.quantity,
      addedAt: item.created_at,
      isShop: profile?.is_shop,
      shopName: profile?.shop_name,
      displayName: profile?.display_name,
      email: profile?.email,
      avatarUrl: profile?.avatar_url,
    })
    if (holder) holders.push(holder)
  }
  return holders
}
