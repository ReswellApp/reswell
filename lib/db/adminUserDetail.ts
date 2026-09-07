import type { SupabaseClient } from "@supabase/supabase-js"

const ADMIN_USER_DETAIL_PROFILE_SELECT =
  "id, email, display_name, avatar_url, city, location, bio, is_admin, shop_verified, sales_count, created_at, updated_at"

export type AdminUserDetailProfileRow = {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  location: string | null
  bio: string | null
  is_admin: boolean
  shop_verified: boolean
  sales_count: number
  created_at: string
  updated_at: string
}

export type AdminUserDetailListingRow = {
  id: string
  title: string
  price: number
  section: string
  status: string
  slug: string | null
  hidden_from_site: boolean | null
  created_at: string
  listing_images: { url: string }[]
}

export async function dbGetAdminUserDetailProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; profile: AdminUserDetailProfileRow }
  | { ok: false; message: string; status: 404 | 500 }
> {
  const { data, error } = await supabase
    .from("profiles")
    .select(ADMIN_USER_DETAIL_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle()

  if (error) {
    console.error("[admin user detail] profile", error)
    return { ok: false, message: "Could not load user", status: 500 }
  }
  if (!data) {
    return { ok: false, message: "User not found", status: 404 }
  }

  return { ok: true, profile: data as AdminUserDetailProfileRow }
}

export async function dbListAdminUserDetailListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<
  | { ok: true; listings: AdminUserDetailListingRow[] }
  | { ok: false; message: string }
> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, title, price, section, status, slug, hidden_from_site, created_at, listing_images(url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[admin user detail] listings", error)
    return { ok: false, message: "Could not load listings" }
  }

  return { ok: true, listings: (data ?? []) as AdminUserDetailListingRow[] }
}
