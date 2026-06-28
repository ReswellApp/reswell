import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { updateListingHiddenFromSite } from "@/lib/db/listings"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"

const VACATION_ALLOWED_STATUSES = new Set(["active", "pending_sale"])

export async function setListingVacationModeForSeller(params: {
  supabase: SupabaseClient
  userId: string
  listingId: string
  vacationMode: boolean
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const listingId = params.listingId.trim()
  if (!listingId) {
    return { ok: false, error: "Missing listing id", status: 400 }
  }

  const { data: listing, error: listingErr } = await params.supabase
    .from("listings")
    .select("id, user_id, status, hidden_from_site")
    .eq("id", listingId)
    .maybeSingle()

  if (listingErr) {
    console.error("[listingVacationMode] load listing:", listingErr.message)
    return { ok: false, error: "Could not load listing", status: 500 }
  }
  if (!listing) {
    return { ok: false, error: "Listing not found", status: 404 }
  }
  if (listing.user_id !== params.userId) {
    return { ok: false, error: "You can only update your own listings", status: 403 }
  }

  const status = String(listing.status ?? "")
  if (!VACATION_ALLOWED_STATUSES.has(status)) {
    return {
      ok: false,
      error: "Vacation mode is only available for live listings",
      status: 409,
    }
  }

  const hiddenFromSite = params.vacationMode
  if (Boolean(listing.hidden_from_site) === hiddenFromSite) {
    return { ok: true }
  }

  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const updated = await updateListingHiddenFromSite(service, listingId, hiddenFromSite)
  if (!updated.ok) {
    return { ok: false, error: updated.message, status: 500 }
  }

  if (hiddenFromSite) {
    try {
      await deleteAllCartRowsForListing(service, listingId)
    } catch {
      // best-effort
    }
  }

  await syncListingToIndex(params.supabase, listingId)
  void syncListingToGoogleMerchantBestEffort(params.supabase, listingId)
  await revalidateAfterListingSiteModeration(params.supabase, [listingId])

  return { ok: true }
}
