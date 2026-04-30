import type { SupabaseClient } from "@supabase/supabase-js"

export type SellListingAreaPrefillCityState = {
  city: string
  state: string
} | null

/**
 * City/region hint for `/sell` (profile default locality, else default address rows).
 * Matches client logic used by `applySellLocationPrefillIfEmpty` on the sell page.
 */
export async function getSellListingAreaPrefillForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<SellListingAreaPrefillCityState> {
  const [{ data: profile }, { data: addr }] = await Promise.all([
    supabase
      .from("profiles")
      .select("default_listing_city, default_listing_state")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("addresses")
      .select("city, state")
      .eq("profile_id", userId)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  const row = profile as {
    default_listing_city?: string | null
    default_listing_state?: string | null
  } | null

  let city = row?.default_listing_city?.trim() ?? ""
  let state = row?.default_listing_state?.trim() ?? ""
  const a = addr as { city?: string | null; state?: string | null } | null
  if (!city && a?.city?.trim()) {
    city = a.city.trim()
    state = a.state?.trim() ?? ""
  }
  if (!city) return null
  return { city, state: state || "" }
}
