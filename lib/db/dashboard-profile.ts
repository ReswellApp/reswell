import type { SupabaseClient } from "@supabase/supabase-js"

export type DashboardProfileRow = {
  id: string
  email: string
  display_name: string
  seller_slug: string | null
  avatar_url: string | null
  avatar_focal_x_pct: number | null
  avatar_focal_y_pct: number | null
  shop_logo_url: string | null
  shop_banner_url: string | null
  shop_banner_focal_x_pct: number | null
  shop_banner_focal_y_pct: number | null
  is_shop: boolean | null
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
  "id, email, display_name, seller_slug, avatar_url, avatar_focal_x_pct, avatar_focal_y_pct, shop_logo_url, shop_banner_url, shop_banner_focal_x_pct, shop_banner_focal_y_pct, is_shop, location, city, bio, first_name, last_name, phone"

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
