import type { SupabaseClient } from "@supabase/supabase-js"
import { listHomeRecentSectionListingIdsOrdered } from "@/lib/db/home-recent-section-listings"
import { HOME_PEER_LISTING_WITH_PROFILE_SELECT } from "@/lib/db/home-peer-listing-feed"
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

function passesFinRow(row: ListingEligibility): boolean {
  if (row.status !== "active") return false
  if (row.hidden_from_site === true) return false
  if (row.hidden_from_homepage === true) return false
  if (row.section !== "fins") return false
  return true
}

export async function loadHomeFeaturedSurfboardRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const curatedIds = await listHomeRecentSectionListingIdsOrdered(supabase, "recent_surfboards")
  if (curatedIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .in("id", curatedIds)

    if (error) {
      console.error("loadHomeFeaturedSurfboardRows (curated):", error.message)
    } else {
      const sorted = sortRecordsByIdOrder((data ?? []) as Array<{ id: string }>, curatedIds)
      const filtered = sorted.filter((r) => passesSiteAndHomeEligibility(r as unknown as ListingEligibility))
      if (filtered.length > 0) return filtered
    }
  }

  const { data: fallbackData, error: fallbackErr } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(20)

  if (fallbackErr) {
    console.error("loadHomeFeaturedSurfboardRows (fallback):", fallbackErr.message)
    return []
  }
  return [...(fallbackData ?? [])].sort(
    (a, b) =>
      new Date((b as { created_at?: string }).created_at ?? "").getTime() -
      new Date((a as { created_at?: string }).created_at ?? "").getTime(),
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
      if (filtered.length > 0) return filtered
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
  return [...(fallbackData ?? [])].sort(
    (a, b) =>
      new Date((b as { created_at?: string }).created_at ?? "").getTime() -
      new Date((a as { created_at?: string }).created_at ?? "").getTime(),
  )
}

export async function loadHomeFeaturedFinRows(
  supabase: SupabaseClient,
): Promise<unknown[]> {
  const curatedIds = await listHomeRecentSectionListingIdsOrdered(supabase, "recent_fins")
  if (curatedIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
      .in("id", curatedIds)

    if (error) {
      console.error("loadHomeFeaturedFinRows (curated):", error.message)
    } else {
      const sorted = sortRecordsByIdOrder((data ?? []) as Array<{ id: string }>, curatedIds)
      const filtered = sorted.filter((r) => passesFinRow(r as unknown as ListingEligibility))
      if (filtered.length > 0) return filtered
    }
  }

  const { data: fallbackData, error: fallbackErr } = await supabase
    .from("listings")
    .select(HOME_PEER_LISTING_WITH_PROFILE_SELECT)
    .eq("status", "active")
    .eq("section", "fins")
    .eq("hidden_from_site", false)
    .eq("hidden_from_homepage", false)
    .order("created_at", { ascending: false })
    .limit(20)

  if (fallbackErr) {
    console.error("loadHomeFeaturedFinRows (fallback):", fallbackErr.message)
    return []
  }
  return [...(fallbackData ?? [])].sort(
    (a, b) =>
      new Date((b as { created_at?: string }).created_at ?? "").getTime() -
      new Date((a as { created_at?: string }).created_at ?? "").getTime(),
  )
}
