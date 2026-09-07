import type { SupabaseClient } from "@supabase/supabase-js"
import { listHomeRecentSectionListingIdsOrdered } from "@/lib/db/home-recent-section-listings"
import {
  HOME_PEER_LISTING_WITH_PROFILE_SELECT,
  hydrateHomePeerListingRows,
} from "@/lib/db/home-peer-listing-feed"
import { sortRecordsByIdOrder } from "@/lib/utils/sort-by-id-order"

type ListingEligibility = {
  status: string | null | undefined
  hidden_from_site: boolean | null | undefined
  hidden_from_homepage: boolean | null | undefined
  section: string | null | undefined
}

function passesSiteAndHomeEligibility(row: ListingEligibility): boolean {
  if (row.status !== "active") return false
  if (row.hidden_from_site === true) return false
  if (row.hidden_from_homepage === true) return false
  if (row.section !== "surfboards") return false
  return true
}

function passesShortboardRow(row: ListingEligibility & { board_type?: string | null | undefined }): boolean {
  return passesSiteAndHomeEligibility(row) && row.board_type === "shortboard"
}

/** Newest active surfboards for the homepage strip — no admin curation override. */
export async function loadHomeFeaturedSurfboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("loadHomeFeaturedSurfboardRows:", error.message)
    return []
  }
  return hydrateHomePeerListingRows(
    [...(data ?? [])].sort(
      (a, b) =>
        new Date((b as { created_at?: string }).created_at ?? "").getTime() -
        new Date((a as { created_at?: string }).created_at ?? "").getTime(),
    ) as Record<string, unknown>[],
  )
}

export async function loadHomeFeaturedShortboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const curatedIds = await listHomeRecentSectionListingIdsOrdered(supabase, "recent_shortboards")
  if (curatedIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .in("id", curatedIds)

    if (error) {
      console.error("loadHomeFeaturedShortboardRows (curated):", error.message)
    } else {
      const sorted = sortRecordsByIdOrder((data ?? []) as Array<{ id: string }>, curatedIds)
      const filtered = sorted.filter((r) =>
        passesShortboardRow(r as unknown as ListingEligibility & { board_type?: string | null }),
      )
      if (filtered.length > 0) {
        return hydrateHomePeerListingRows(filtered as Record<string, unknown>[])
      }
    }
  }

  const { data: fallbackData, error: fallbackErr } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("board_type", "shortboard")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(20)

  if (fallbackErr) {
    console.error("loadHomeFeaturedShortboardRows (fallback):", fallbackErr.message)
    return []
  }
  return hydrateHomePeerListingRows(
    [...(fallbackData ?? [])].sort(
      (a, b) =>
        new Date((b as { created_at?: string }).created_at ?? "").getTime() -
        new Date((a as { created_at?: string }).created_at ?? "").getTime(),
    ) as Record<string, unknown>[],
  )
}

/** Newest active fins for the homepage strip — no admin curation override. */
export async function loadHomeFeaturedFinRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", "fins")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("loadHomeFeaturedFinRows:", error.message)
    return []
  }
  return hydrateHomePeerListingRows(
    [...(data ?? [])].sort(
      (a, b) =>
        new Date((b as { created_at?: string }).created_at ?? "").getTime() -
        new Date((a as { created_at?: string }).created_at ?? "").getTime(),
    ) as Record<string, unknown>[],
  )
}
