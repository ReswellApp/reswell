import type { SupabaseClient } from "@supabase/supabase-js"

export const KLAVIYO_INACTIVITY_LISTINGS_POOL = 72
export const KLAVIYO_INACTIVITY_LISTINGS_CAP = 12

export type RecentPublicListingRowForKlaviyo = {
  id: string
  user_id: string
  slug: string | null
  title: string
  price: number | null
  section: string
  brand: string | null
  city: string | null
  state: string | null
  created_at: string
  listing_images: { url: string; is_primary: boolean | null }[] | null
}

const LISTING_SELECT = `
  id,
  user_id,
  slug,
  title,
  price,
  section,
  brand,
  city,
  state,
  created_at,
  listing_images ( url, is_primary )
`

/** Newest marketplace-visible listings (pool for inactive-email personalization). */
export async function fetchRecentPublicListingsPoolForKlaviyo(
  supabase: SupabaseClient,
  poolLimit: number = KLAVIYO_INACTIVITY_LISTINGS_POOL,
): Promise<{ data: RecentPublicListingRowForKlaviyo[]; error: string | null }> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(poolLimit)

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = Array.isArray(data) ? (data as RecentPublicListingRowForKlaviyo[]) : []

  return { data: rows, error: null }
}
