import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { getDb } from "@/lib/supabase/db"

export type MobileProfileRow = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  location: string | null
  bio: string | null
  created_at: string
  is_shop: boolean | null
  shop_name: string | null
  shop_description: string | null
  shop_banner_url: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_website: string | null
  shop_phone: string | null
  shop_address: string | null
  sales_count: number | null
  follower_count: number | null
  seller_banned_at: string | null
}

const MOBILE_PROFILE_SELECT = `
  id,
  seller_slug,
  display_name,
  avatar_url,
  city,
  location,
  bio,
  created_at,
  is_shop,
  shop_name,
  shop_description,
  shop_banner_url,
  shop_logo_url,
  shop_verified,
  shop_website,
  shop_phone,
  shop_address,
  sales_count,
  follower_count,
  seller_banned_at
`

export async function fetchMobileProfileBySlug(
  slug: string,
): Promise<{ ok: true; row: MobileProfileRow | null } | { ok: false; message: string }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { data, error } = await supabase
    .from("profiles")
    .select(MOBILE_PROFILE_SELECT)
    .eq("seller_slug", slug)
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  return { ok: true, row: (data as MobileProfileRow | null) ?? null }
}

/** Active peer inventory shown on a public profile. Sold history is a later resource. */
export async function countMobileProfileListings(
  sellerId: string,
): Promise<{ ok: true; count: number } | { ok: false; message: string }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { count, error } = await supabase
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", sellerId)
    .in("section", PEER_LISTING_SECTIONS_FILTER)
    .in("status", ["active", "pending_sale"])
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (error) return { ok: false, message: error.message }
  return { ok: true, count: count ?? 0 }
}
