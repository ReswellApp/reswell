import type { SupabaseClient } from "@supabase/supabase-js"

export type DashboardProfileRow = {
  id: string
  email: string
  display_name: string
  avatar_url: string | null
  shop_banner_url: string | null
  location: string | null
  city: string | null
  bio: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

export type FetchDashboardProfileResult = {
  profile: DashboardProfileRow | null
  error?: string
}

const DASHBOARD_PROFILE_SELECT =
  "id, email, display_name, avatar_url, shop_banner_url, location, city, bio, first_name, last_name, phone"

export async function fetchDashboardProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<FetchDashboardProfileResult> {
  const { data, error } = await supabase
    .from("profiles")
    .select(DASHBOARD_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    return { profile: null, error: error.message }
  }

  if (!data) {
    return { profile: null, error: "Profile not found" }
  }

  return { profile: data as DashboardProfileRow }
}
