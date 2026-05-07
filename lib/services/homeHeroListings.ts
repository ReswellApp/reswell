import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deleteHomeHeroListingRow,
  insertHomeHeroListing,
  listHomeHeroListingRows,
  searchListingsForHeroPicker,
  type HomeHeroListingRow,
  type HomeHeroListingSearchHit,
} from "@/lib/db/home-hero-listings"

/**
 * Insert uses the service role after the route verifies admin so RLS on `home_hero_listings`
 * cannot block legitimate inserts, and to allow reading `listings` without RLS interference.
 */
export async function addHomeHeroListingService(
  listingId: string,
): Promise<{ ok: true; id: string } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("addHomeHeroListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  // Guard: only allow adding real, visible, active listings.
  const { data: listing, error } = await svc
    .from("listings")
    .select("id, status, hidden_from_site, hidden_from_homepage")
    .eq("id", listingId)
    .maybeSingle()

  if (error) {
    console.error("addHomeHeroListingService (listing lookup):", error.message)
    return { ok: false, error: "Could not verify listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }
  if (
    listing.status !== "active" ||
    listing.hidden_from_site === true ||
    listing.hidden_from_homepage === true
  ) {
    return { ok: false, error: "Only active, homepage-visible listings can be added", status: 400 }
  }

  const result = await insertHomeHeroListing(svc, listingId)
  if (!result.ok) {
    const status = result.alreadyExists ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true, id: result.id }
}

export async function listHomeHeroListingsForAdminService(
  supabase: SupabaseClient,
): Promise<{ ok: true; rows: HomeHeroListingRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listHomeHeroListingRows(supabase)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load hero listings" }
  }
}

export async function deleteHomeHeroListingService(
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  let svc: ReturnType<typeof createServiceRoleClient>
  try {
    svc = createServiceRoleClient()
  } catch (e) {
    console.error("deleteHomeHeroListingService: missing service role", e)
    return { ok: false, error: "Server configuration error", status: 500 }
  }

  const result = await deleteHomeHeroListingRow(svc, id)
  if (!result.ok) {
    const isNotFound = /no row deleted|not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}

export async function searchHeroPickerListingsService(
  supabase: SupabaseClient,
  query: string,
  limit: number,
): Promise<{ ok: true; hits: HomeHeroListingSearchHit[] } | { ok: false; error: string }> {
  try {
    const hits = await searchListingsForHeroPicker(supabase, query, limit)
    return { ok: true, hits }
  } catch (e) {
    console.error("searchHeroPickerListingsService:", e)
    return { ok: false, error: "Could not search listings" }
  }
}
