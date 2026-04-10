import type { SupabaseClient } from "@supabase/supabase-js"

/** Whether the current user may view a listing that has hidden_from_site set. */
export async function canViewHiddenListing(
  supabase: SupabaseClient,
  listing: { user_id: string; hidden_from_site?: boolean | null },
): Promise<boolean> {
  if (!listing.hidden_from_site) return true

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user?.id === listing.user_id) return true
  if (!user) return false

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  return prof?.is_admin === true || prof?.is_employee === true
}
