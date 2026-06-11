import type { SupabaseClient } from "@supabase/supabase-js"

/** Whether the current user may view a listing that is hidden or removed from the public site. */
export async function canViewHiddenListing(
  supabase: SupabaseClient,
  listing: {
    user_id: string
    status?: string | null
    hidden_from_site?: boolean | null
    archived_at?: string | null
  },
): Promise<boolean> {
  if (listing.status === "sold") return true
  if (listing.archived_at) return false

  const restrictedFromPublic =
    listing.hidden_from_site === true || listing.status === "removed"

  if (!restrictedFromPublic) return true

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
