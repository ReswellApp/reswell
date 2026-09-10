import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteListingDocument } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import {
  fetchListingImageUrlsForListingIds,
  removeListingImageFilesFromStorage,
} from "@/lib/services/listingStorageCleanup"
import { listingCanBePermanentlyDeleted } from "@/lib/db/listingDeleteEligibility"

type ListingEndRow = {
  id: string
  user_id: string
  status: string
  slug: string | null
}

export type EndSellerListingResult =
  | { ok: true; mode: "delete" }
  | { ok: false; status: number; error: string }

export type DeleteSellerDraftListingResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

const ORDER_HISTORY_DELETE_BLOCKED_MESSAGE =
  "This listing is tied to an order or payment, so it cannot be permanently deleted."

async function loadListingForEnd(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingEndRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("id, user_id, status, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingEndRow
}

/**
 * Permanently removes a surfboard listing that is still in `draft` status (seller-only).
 * Cleans Elasticsearch and storage like a full delete.
 */
export async function deleteSellerDraftListing(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string },
): Promise<DeleteSellerDraftListingResult> {
  const { listingId, sellerUserId } = params

  const row = await loadListingForEnd(supabase, listingId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }
  if (row.status !== "draft") {
    return { ok: false, status: 400, error: "Not a draft" }
  }

  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, [listingId])

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    return { ok: false, status: 500, error: "Failed to delete draft" }
  }

  try {
    await deleteListingDocument(listingId)
  } catch {
    // ES optional
  }

  await removeListingFromGoogleMerchantFeed(listingId)

  revalidateListingDetailPage(listingId, row.slug)

  try {
    await removeListingImageFilesFromStorage(supabase, imageUrls)
  } catch {
    // best-effort
  }

  await revalidateSellersAfterListingChange(supabase, sellerUserId)

  return { ok: true }
}

/**
 * Seller permanently deletes a listing. Listings tied to an order or payment cannot be deleted.
 */
export async function endSellerListing(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string },
): Promise<EndSellerListingResult> {
  const { listingId, sellerUserId } = params

  const row = await loadListingForEnd(supabase, listingId)
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const canDelete = await listingCanBePermanentlyDeleted(supabase, listingId)
  if (!canDelete) {
    return { ok: false, status: 409, error: ORDER_HISTORY_DELETE_BLOCKED_MESSAGE }
  }

  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, [listingId])

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    if (error.code === "23503") {
      return { ok: false, status: 409, error: ORDER_HISTORY_DELETE_BLOCKED_MESSAGE }
    }
    return { ok: false, status: 500, error: "Failed to delete listing" }
  }

  try {
    await deleteListingDocument(listingId)
  } catch {
    // ES optional
  }

  await removeListingFromGoogleMerchantFeed(listingId)

  revalidateListingDetailPage(listingId, row.slug)

  try {
    await removeListingImageFilesFromStorage(supabase, imageUrls)
  } catch {
    // best-effort cleanup after DB delete
  }

  revalidateBoardsBrowseCatalog()
  await revalidateSellersAfterListingChange(supabase, sellerUserId)

  return { ok: true, mode: "delete" }
}
