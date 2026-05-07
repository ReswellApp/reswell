import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteHomeRecentSectionListingRow,
  insertHomeRecentSectionListing,
  listHomeRecentSectionCurationRows,
  reorderHomeRecentSectionListingRows,
  searchListingsForHomeRecentSectionPicker,
  type HomeRecentSectionCurationRow,
  type HomeRecentSectionKey,
  type HomeRecentSectionSearchHit,
} from "@/lib/db/home-recent-section-listings"

export async function addHomeRecentSectionListingService(params: {
  key: HomeRecentSectionKey
  listingId: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addHomeRecentSectionListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: listing, error } = await svc
    .from("listings")
    .select("id, status, hidden_from_site, hidden_from_homepage, section, board_type")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    console.error("addHomeRecentSectionListingService (lookup):", error.message)
    return { ok: false, error: "Could not verify listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const row = listing as {
    status?: string | null
    hidden_from_site?: boolean | null
    hidden_from_homepage?: boolean | null
    section?: string | null
    board_type?: string | null
  }

  if (row.status !== "active" || row.hidden_from_site === true || row.hidden_from_homepage === true) {
    return { ok: false, error: "Only active homepage-visible listings can be featured here", status: 400 }
  }
  if (row.section !== "surfboards") {
    return { ok: false, error: "Only surfboard listings can appear in this row", status: 400 }
  }
  if (params.key === "recent_shortboards" && row.board_type !== "shortboard") {
    return { ok: false, error: "Only shortboard listings can appear in the shortboard row", status: 400 }
  }

  const result = await insertHomeRecentSectionListing(svc, params.key, params.listingId)
  if (!result.ok) {
    const status = result.alreadyExists ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true, id: result.id }
}

export async function listHomeRecentSectionListingsForAdminService(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
): Promise<{ ok: true; rows: HomeRecentSectionCurationRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listHomeRecentSectionCurationRows(supabase, key)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load curated listings" }
  }
}

export async function deleteHomeRecentSectionListingService(
  key: HomeRecentSectionKey,
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteHomeRecentSectionListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteHomeRecentSectionListingRow(svc, key, rowId)
  if (!result.ok) {
    const isNotFound = /no row deleted|not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}

export async function reorderHomeRecentSectionListingsService(
  key: HomeRecentSectionKey,
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("reorderHomeRecentSectionListingsService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await reorderHomeRecentSectionListingRows(svc, key, orderedRowIds)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }
  return { ok: true }
}

export async function searchHomeRecentSectionPickerService(
  supabase: SupabaseClient,
  key: HomeRecentSectionKey,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: HomeRecentSectionSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchListingsForHomeRecentSectionPicker(supabase, key, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchHomeRecentSectionPickerService:", e)
    return { ok: false, error: "Could not search listings" }
  }
}
