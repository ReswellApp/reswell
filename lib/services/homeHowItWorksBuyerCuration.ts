import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { HowItWorksBuyerCurationSlot } from "@/lib/db/home-how-it-works-buyer-curation"
import {
  deleteHowItWorksBuyerListingSlot,
  listHowItWorksBuyerCurationRowsForAdmin,
  searchListingsForHowItWorksBuyerPicker,
  upsertHowItWorksBuyerListingSlot,
  type HowItWorksBuyerCurationRow,
  type HowItWorksBuyerSearchHit,
} from "@/lib/db/home-how-it-works-buyer-curation"

export async function upsertHowItWorksBuyerListingService(params: {
  boardType: HowItWorksBuyerCurationSlot
  listingId: string
}): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("upsertHowItWorksBuyerListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const { data: listing, error } = await svc
    .from("listings")
    .select("id, status, hidden_from_site, hidden_from_homepage, section, board_type")
    .eq("id", params.listingId)
    .maybeSingle()

  if (error) {
    console.error("upsertHowItWorksBuyerListingService (lookup):", error.message)
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
    return { ok: false, error: "Only surfboard listings can appear here", status: 400 }
  }
  if (row.board_type !== params.boardType) {
    return { ok: false, error: "Listing board type must match this column", status: 400 }
  }

  const result = await upsertHowItWorksBuyerListingSlot(svc, params.boardType, params.listingId)
  if (!result.ok) {
    return { ok: false, error: result.error, status: 500 }
  }
  return { ok: true }
}

export async function listHowItWorksBuyerRowsForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: HowItWorksBuyerCurationRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listHowItWorksBuyerCurationRowsForAdmin(supabase)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load curated listings" }
  }
}

export async function deleteHowItWorksBuyerListingService(
  boardType: HowItWorksBuyerCurationSlot,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteHowItWorksBuyerListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteHowItWorksBuyerListingSlot(svc, boardType)
  if (!result.ok) {
    const status = /no row deleted/i.test(result.error) ? 404 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true }
}

export async function searchHowItWorksBuyerPickerService(
  supabase: SupabaseClient,
  slot: HowItWorksBuyerCurationSlot,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: HowItWorksBuyerSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchListingsForHowItWorksBuyerPicker(supabase, slot, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchHowItWorksBuyerPickerService:", e)
    return { ok: false, error: "Could not search listings" }
  }
}
