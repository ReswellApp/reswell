import type { SupabaseClient, User } from "@supabase/supabase-js"

import { isAdminSeedListingTitle } from "@/lib/utils/admin-seed-listing"

/** Whether the current user may view a listing that is hidden or removed from the public site. */
export async function canViewHiddenListing(
  supabase: SupabaseClient,
  listing: {
    user_id: string
    title?: string | null
    status?: string | null
    hidden_from_site?: boolean | null
    archived_at?: string | null
  },
  viewerUser?: User | null,
): Promise<boolean> {
  const resolveViewer = async (): Promise<User | null> => {
    if (viewerUser !== undefined) return viewerUser
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return user ?? null
  }

  if (isAdminSeedListingTitle(listing.title)) {
    const user = await resolveViewer()
    if (!user) return false
    const { data: prof } = await supabase
      .from("profiles")
      .select("is_admin, is_employee")
      .eq("id", user.id)
      .maybeSingle()
    return prof?.is_admin === true || prof?.is_employee === true
  }
  if (listing.status === "sold") {
    if (listing.hidden_from_site && !listing.archived_at) {
      // Admin hide-from-site on a sold listing — not public (seller archive keeps sold PDP).
    } else {
      return true
    }
  } else if (listing.archived_at) {
    return false
  }

  const restrictedFromPublic =
    listing.hidden_from_site === true ||
    listing.status === "removed" ||
    listing.status === "delinquent"

  if (!restrictedFromPublic) return true

  const user = await resolveViewer()
  if (user?.id === listing.user_id) return true
  if (!user) return false

  const { data: prof } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", user.id)
    .maybeSingle()

  return prof?.is_admin === true || prof?.is_employee === true
}
