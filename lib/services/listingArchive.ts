import type { SupabaseClient } from "@supabase/supabase-js"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateMarketplaceSoldFeedCatalog } from "@/lib/cache/revalidate-marketplace-sold-feed"
import { removeListingFromGoogleMerchantFeed } from "@/lib/services/googleMerchantSync"
import { deleteNonWinningOffersOnListings } from "@/lib/services/offerCleanup"
import { revalidateAfterListingSiteModeration } from "@/lib/services/listingSiteModerationRevalidation"
import {
  recordListingVisibilityEvent,
  visibilityEventInput,
} from "@/lib/services/listingVisibilityAudit"
import {
  listingArchivePatch,
  type ListingArchiveReason,
} from "@/lib/listing-archive"
import { createServiceRoleClient } from "@/lib/supabase/server"

export type ListingArchiveSource = ListingArchiveReason

type ListingArchiveRow = {
  id: string
  user_id: string
  status: string
  archived_at: string | null
}

export type ArchiveListingResult =
  | { ok: true; alreadyArchived: boolean }
  | { ok: false; error: string }

function serviceOrFallback(fallback: SupabaseClient): SupabaseClient {
  try {
    return createServiceRoleClient()
  } catch {
    return fallback
  }
}

/**
 * Hide a listing and keep the row so orders, returns, and other restrict
 * references stay valid. Drops it from search, carts, and open offers.
 */
export async function archiveListingPreservingHistory(
  supabase: SupabaseClient,
  params: {
    listingId: string
    actorUserId?: string | null
    source: ListingArchiveSource
  },
): Promise<ArchiveListingResult> {
  const listingId = params.listingId.trim()
  if (!listingId) return { ok: false, error: "Missing listing id" }

  const writer = serviceOrFallback(supabase)
  const { data, error: lookupError } = await writer
    .from("listings")
    .select("id, user_id, status, archived_at")
    .eq("id", listingId)
    .maybeSingle()

  if (lookupError) {
    console.error("[archiveListingPreservingHistory] lookup", lookupError.message)
    return { ok: false, error: "Failed to load listing" }
  }
  if (!data) return { ok: false, error: "Listing not found" }

  const row = data as ListingArchiveRow
  const alreadyArchived = typeof row.archived_at === "string" && row.archived_at.length > 0

  if (!alreadyArchived) {
    const archivedAt = new Date().toISOString()
    const patch = listingArchivePatch({
      status: row.status,
      archivedAt,
      reason: params.source,
    })
    const { error: updateError } = await writer.from("listings").update(patch).eq("id", listingId)
    if (updateError) {
      console.error("[archiveListingPreservingHistory] update", updateError.message)
      return { ok: false, error: "Failed to archive listing" }
    }

    await recordListingVisibilityEvent(
      writer,
      visibilityEventInput({
        listingId,
        hiddenFromSite: true,
        source: params.source,
        actorUserId: params.actorUserId,
        note: "Archived because the listing is still referenced by an order or related record.",
      }),
    )
  }

  try {
    await deleteAllCartRowsForListing(writer, listingId)
  } catch (error) {
    console.error("[archiveListingPreservingHistory] carts", error)
  }

  try {
    await deleteNonWinningOffersOnListings(writer, [listingId])
  } catch (error) {
    console.error("[archiveListingPreservingHistory] offers", error)
  }

  try {
    await syncListingToIndex(writer, listingId)
  } catch {
    // Elasticsearch is optional
  }

  await removeListingFromGoogleMerchantFeed(listingId)

  await revalidateAfterListingSiteModeration(writer, [listingId])
  if (row.status === "sold") {
    revalidateMarketplaceSoldFeedCatalog()
  }

  return { ok: true, alreadyArchived }
}
