import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerSellPageKlaviyoContext = {
  activeListingCount: number
  draftListingCount: number
  /** When `editListingId` is set and owned by the seller */
  editListingStatus: string | null
}

/**
 * Lightweight seller snapshot for sell-page Klaviyo events (one edit lookup + two counts).
 */
export async function fetchSellerSellPageKlaviyoContext(
  supabase: SupabaseClient,
  sellerUserId: string,
  editListingId: string | null,
): Promise<SellerSellPageKlaviyoContext> {
  const uid = sellerUserId.trim()
  let editListingStatus: string | null = null

  if (editListingId?.trim()) {
    const { data } = await supabase
      .from("listings")
      .select("status")
      .eq("id", editListingId.trim())
      .eq("user_id", uid)
      .maybeSingle()
    editListingStatus =
      typeof data?.status === "string" ? data.status.trim() || null : null
  }

  const [activeRes, draftRes] = await Promise.all([
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "active"),
    supabase
      .from("listings")
      .select("id", { count: "exact", head: true })
      .eq("user_id", uid)
      .eq("status", "draft"),
  ])

  return {
    activeListingCount: activeRes.count ?? 0,
    draftListingCount: draftRes.count ?? 0,
    editListingStatus,
  }
}
