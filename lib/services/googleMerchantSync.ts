import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getGoogleMerchantListingById,
  listGoogleMerchantListingBatch,
} from "@/lib/db/google-merchant-listings"
import { isGoogleMerchantConfigured } from "@/lib/google-merchant/config"
import {
  isGoogleMerchantEligibleListing,
  mapListingToProductInput,
} from "@/lib/google-merchant/map-listing-to-product-input"
import {
  deleteGoogleMerchantProductInput,
  insertGoogleMerchantProductInput,
} from "@/lib/services/googleMerchantSetup"

export type GoogleMerchantSyncListingResult =
  | { action: "inserted" | "deleted" | "skipped"; offerId: string }
  | { action: "error"; offerId: string; error: string }

export async function syncListingToGoogleMerchant(
  supabase: SupabaseClient,
  listingId: string,
): Promise<GoogleMerchantSyncListingResult> {
  if (!isGoogleMerchantConfigured()) {
    return { action: "skipped", offerId: listingId }
  }

  const listing = await getGoogleMerchantListingById(supabase, listingId)
  if (!listing) {
    const deleted = await deleteGoogleMerchantProductInput(listingId)
    if (!deleted.ok && deleted.status !== 404) {
      return { action: "error", offerId: listingId, error: deleted.error }
    }
    return { action: "deleted", offerId: listingId }
  }

  const productInput = mapListingToProductInput(listing)
  if (!productInput) {
    const deleted = await deleteGoogleMerchantProductInput(listing.id)
    if (!deleted.ok && deleted.status !== 404) {
      return { action: "error", offerId: listing.id, error: deleted.error }
    }
    return { action: "deleted", offerId: listing.id }
  }

  const inserted = await insertGoogleMerchantProductInput(productInput)
  if (!inserted.ok) {
    return { action: "error", offerId: listing.id, error: inserted.error }
  }

  return { action: "inserted", offerId: listing.id }
}

export type GoogleMerchantBulkSyncSummary = {
  processed: number
  inserted: number
  deleted: number
  skipped: number
  errors: number
  error_samples: Array<{ offerId: string; error: string }>
}

export async function syncAllActiveListingsToGoogleMerchant(
  supabase: SupabaseClient,
): Promise<GoogleMerchantBulkSyncSummary> {
  const summary: GoogleMerchantBulkSyncSummary = {
    processed: 0,
    inserted: 0,
    deleted: 0,
    skipped: 0,
    errors: 0,
    error_samples: [],
  }

  if (!isGoogleMerchantConfigured()) {
    return summary
  }

  const pageSize = 100
  let from = 0

  for (;;) {
    const batch = await listGoogleMerchantListingBatch(supabase, { from, limit: pageSize })
    if (batch.length === 0) break

    for (const listing of batch) {
      summary.processed += 1
      if (!isGoogleMerchantEligibleListing(listing)) {
        summary.skipped += 1
        continue
      }

      const productInput = mapListingToProductInput(listing)
      if (!productInput) {
        summary.skipped += 1
        continue
      }

      const result = await insertGoogleMerchantProductInput(productInput)
      if (result.ok) {
        summary.inserted += 1
      } else {
        summary.errors += 1
        if (summary.error_samples.length < 10) {
          summary.error_samples.push({ offerId: listing.id, error: result.error })
        }
      }
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  return summary
}
