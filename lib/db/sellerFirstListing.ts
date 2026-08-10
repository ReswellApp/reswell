import type { SupabaseClient } from "@supabase/supabase-js"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { createServiceRoleClient } from "@/lib/supabase/server"

function serviceOrFallback(supabase: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return supabase
  }
}

/**
 * True when the seller has at least one non-draft listing (any section).
 * Used to pick Quick List vs Guided boards for first-time publishers.
 */
export async function sellerHasAnyPublishedListing(
  supabase: SupabaseClient,
  sellerUserId: string,
): Promise<boolean> {
  const uid = sellerUserId.trim()
  if (!uid) return false

  const client = serviceOrFallback(supabase)
  const { count, error } = await client
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .neq("status", "draft")

  if (error) {
    console.error(
      "[sellerFirstListing] any published listing count failed:",
      error.message,
    )
    // Fail open to Guided — returning publishers should not be forced into Quick.
    return true
  }

  return (count ?? 0) > 0
}

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

  const client = serviceOrFallback(_supabase)

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
