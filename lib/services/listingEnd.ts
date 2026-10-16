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
import { isListingForeignKeyDeleteError } from "@/lib/listing-archive"
import { archiveListingPreservingHistory } from "@/lib/services/listingArchive"

type ListingEndRow = {
  id: string
  user_id: string
  status: string
  slug: string | null
}

export type EndSellerListingResult =
  | { ok: true; mode: "delete" | "archive" }
  | { ok: false; status: number; error: string }

export type DeleteSellerDraftListingResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

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

async function archiveSellerListing(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string },
): Promise<EndSellerListingResult> {
  const archived = await archiveListingPreservingHistory(supabase, {
    listingId: params.listingId,
    actorUserId: params.sellerUserId,
    source: "seller_archive",
  })
  if (!archived.ok) {
    return { ok: false, status: 500, error: archived.error }
  }
  return { ok: true, mode: "archive" }
}

/**
 * Seller removes a listing. Rows still referenced by an order are archived
 * instead of erased, so the order stays intact and the listing leaves the site.
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
    return archiveSellerListing(supabase, { listingId, sellerUserId })
  }

  const imageUrls = await fetchListingImageUrlsForListingIds(supabase, [listingId])

  const { error } = await supabase
    .from("listings")
    .delete()
    .eq("id", listingId)
    .eq("user_id", sellerUserId)

  if (error) {
    if (isListingForeignKeyDeleteError(error)) {
      return archiveSellerListing(supabase, { listingId, sellerUserId })
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
