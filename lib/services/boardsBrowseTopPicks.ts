import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteBoardsBrowseTopPickListingRow,
  deleteStaleBoardsBrowseTopPickListingRows,
  insertBoardsBrowseTopPickListing,
  listBoardsBrowseTopPickCurationRows,
  reorderBoardsBrowseTopPickListingRows,
  searchListingsForBoardsBrowseTopPickPicker,
  type BoardsBrowseTopPickCurationRow,
  type BoardsBrowseTopPickSearchHit,
} from "@/lib/db/boards-browse-top-picks"

export async function addBoardsBrowseTopPickService(params: {
  listingId: string
}): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addBoardsBrowseTopPickService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: listing, error } = await svc
    .from("listings")
    .select("id, status, hidden_from_site, section")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    console.error("addBoardsBrowseTopPickService (lookup):", error.message)
    return { ok: false, error: "Could not verify listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }

  const row = listing as {
    status?: string | null
    hidden_from_site?: boolean | null
    section?: string | null
  }

  if (row.status !== "active" || row.hidden_from_site === true) {
    return { ok: false, error: "Only active, site-visible surfboard listings can be Top Picks", status: 400 }
  }
  if (row.section !== "surfboards") {
    return { ok: false, error: "Only surfboard listings can be Top Picks", status: 400 }
  }

  const result = await insertBoardsBrowseTopPickListing(svc, params.listingId)
  if (!result.ok) {
    const status = result.alreadyExists ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true, id: result.id }
}

export async function listBoardsBrowseTopPicksForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: BoardsBrowseTopPickCurationRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listBoardsBrowseTopPickCurationRows(supabase)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load Top Picks" }
  }
}

export async function deleteBoardsBrowseTopPickService(
  rowId: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteBoardsBrowseTopPickService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteBoardsBrowseTopPickListingRow(svc, rowId)
  if (!result.ok) {
    const isNotFound = /no row deleted|not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}

export async function reorderBoardsBrowseTopPicksService(
  orderedRowIds: string[],
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("reorderBoardsBrowseTopPicksService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await reorderBoardsBrowseTopPickListingRows(svc, orderedRowIds)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }
  return { ok: true }
}

export async function searchBoardsBrowseTopPickPickerService(
  supabase: SupabaseClient,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: BoardsBrowseTopPickSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchListingsForBoardsBrowseTopPickPicker(supabase, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchBoardsBrowseTopPickPickerService:", e)
    return { ok: false, error: "Could not search listings" }
  }
}

export async function cleanupStaleBoardsBrowseTopPicksService(): Promise<
  { ok: true; removed: number } | { ok: false; error: string; status?: number }
> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("cleanupStaleBoardsBrowseTopPicksService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteStaleBoardsBrowseTopPickListingRows(svc)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }
  return { ok: true, removed: result.removed }
}
