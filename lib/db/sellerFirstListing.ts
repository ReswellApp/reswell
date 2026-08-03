import type { SupabaseClient } from "@supabase/supabase-js"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Returns true when the seller has already published at least one non-draft
 * listing in `section` other than `excludeListingId` (the listing just created).
 * Drafts do not count — first publish of a category still qualifies.
 *
 * Uses the service role so sold/expired rows are visible regardless of caller RLS.
 */
export async function sellerHasPriorPublishedListingInSection(
  _supabase: SupabaseClient,
  sellerUserId: string,
  section: PeerListingSection,
  excludeListingId: string,
): Promise<boolean> {
  const uid = sellerUserId.trim()
  const listingId = excludeListingId.trim()
  if (!uid || !listingId) return true

  let client: SupabaseClient
  try {
    client = createServiceRoleClient()
  } catch {
    client = _supabase
  }

  const { count, error } = await client
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("section", section)
    .neq("id", listingId)
    .neq("status", "draft")

  if (error) {
    console.error(
      "[sellerFirstListing] prior listing count failed:",
      error.message,
    )
    // Fail closed — do not fire first-time lifecycle emails on uncertain data.
    return true
  }

  return (count ?? 0) > 0
}
