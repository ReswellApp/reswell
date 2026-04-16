import type { SupabaseClient } from "@supabase/supabase-js"
import {
  deleteListingDocument,
  syncListingToIndex,
} from "@/lib/elasticsearch/listings-index"
import {
  fetchListingImageUrlsForListingIds,
  removeListingImageFilesFromStorage,
} from "@/lib/services/listingStorageCleanup"

type ListingEndRow = {
  id: string
  user_id: string
  status: string
  archived_at: string | null
}

export type EndSellerListingResult =
  | { ok: true; mode: "archive" }
  | { ok: true; mode: "delete" }
  | { ok: false; status: number; error: string }

async function loadListingForEnd(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingEndRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, status, archived_at")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingEndRow
}

/**
 * Seller ends a listing: archive (30-day retention) or permanent delete.
 */
export async function endSellerListing(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string; mode: "archive" | "delete" },
): Promise<EndSellerListingResult> {
  const { listingId, sellerUserId, mode } = params

  const row = await loadListingForEnd(supabase, listingId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  if (mode === "archive") {
    if (row.archived_at) {
      return { ok: false, status: 400, error: "Listing is already archived" }
    }
    if (row.status === "draft") {
      return {
        ok: false,
        status: 400,
        error: "Discard drafts from the dashboard instead.",
      }
    }

    const nextStatus = row.status === "sold" ? "sold" : "removed"

    const { error } = await supabase
      .from("listings")
      .update({
        status: nextStatus,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", listingId)
      .eq("user_id", sellerUserId)
      .is("archived_at", null)

    if (error) {
      return { ok: false, status: 500, error: "Failed to archive listing" }
    }

    try {
      await syncListingToIndex(supabase, listingId)
    } catch {
      // ES optional
    }

    return { ok: true, mode: "archive" }
  }

  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, [listingId])

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    if (error.code === "23503") {
      return {
        ok: false,
        status: 409,
        error:
          "This listing cannot be deleted because it is linked to an order or payment. Contact support if you need help.",
      }
    }
    return { ok: false, status: 500, error: "Failed to delete listing" }
  }

  try {
    await deleteListingDocument(listingId)
  } catch {
    // ES optional
  }

  try {
    await removeListingImageFilesFromStorage(supabase, imageUrls)
  } catch {
    // best-effort cleanup after DB delete
  }

  return { ok: true, mode: "delete" }
}
