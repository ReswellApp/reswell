import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getGoogleMerchantListingById,
  listGoogleMerchantListingBatch,
  listShippableSurfboardMerchantListingBatch,
} from "@/lib/db/google-merchant-listings"
import {
  GOOGLE_MERCHANT_OUTSURFING_SHOP_SELLER_EMAIL,
  GOOGLE_MERCHANT_SHIPPING_CUSTOM_LABEL,
  getGoogleMerchantShippableSurfboardsDataSourceName,
  getGoogleMerchantShippableSurfboardsFeedLabel,
  isGoogleMerchantConfigured,
  isGoogleMerchantShippableSurfboardsFeedConfigured,
  matchesGoogleMerchantFeedProduct,
} from "@/lib/google-merchant/config"
import {
  isGoogleMerchantEligibleListing,
  isShippableSurfboardGoogleMerchantListing,
  mapListingToProductInput,
  type GoogleMerchantListingRow,
  type GoogleMerchantProductInputContext,
} from "@/lib/google-merchant/map-listing-to-product-input"
import {
  deleteGoogleMerchantProductInput,
  insertGoogleMerchantProductInput,
  listAllGoogleMerchantProducts,
} from "@/lib/services/googleMerchantSetup"
import { syncListingToKlaviyoCatalogBestEffort } from "@/lib/services/klaviyoCatalogSync"
import { findUserIdByEmail } from "@/lib/services/resolveUserIdByEmail"

/**
 * Resolves OutSurfing’s seller profile id for Google Merchant `customLabel1`.
 * Prefer `GOOGLE_MERCHANT_OUTSURFING_SHOP_USER_ID`, else email
 * (`GOOGLE_MERCHANT_OUTSURFING_SHOP_SELLER_EMAIL` or davidacason@gmail.com).
 */
export async function resolveGoogleMerchantOutSurfingShopUserId(
  supabase: SupabaseClient,
): Promise<string | null> {
  const byIdRaw = process.env.GOOGLE_MERCHANT_OUTSURFING_SHOP_USER_ID?.trim()
  if (byIdRaw) {
    const parsed = z.string().uuid().safeParse(byIdRaw)
    if (parsed.success) return parsed.data
    console.warn(
      "[google-merchant] GOOGLE_MERCHANT_OUTSURFING_SHOP_USER_ID is not a valid UUID; falling back to email lookup",
    )
  }

  const email =
    process.env.GOOGLE_MERCHANT_OUTSURFING_SHOP_SELLER_EMAIL?.trim() ||
    GOOGLE_MERCHANT_OUTSURFING_SHOP_SELLER_EMAIL
  return findUserIdByEmail(supabase, email)
}

async function googleMerchantProductInputContext(
  supabase: SupabaseClient,
): Promise<GoogleMerchantProductInputContext> {
  const outSurfingShopUserId = await resolveGoogleMerchantOutSurfingShopUserId(supabase)
  return { outSurfingShopUserId }
}

export type GoogleMerchantSyncListingResult =
  | { action: "inserted" | "deleted" | "skipped"; offerId: string }
  | { action: "error"; offerId: string; error: string }

/**
 * Fire-and-forget helper for listing mutations. Logs failures; never throws.
 * Uses Next.js `after()` so the sync completes on Vercel after the response is sent.
 */
export function syncListingToGoogleMerchantBestEffort(
  supabase: SupabaseClient,
  listingId: string,
): void {
  // Publish, price, hide, and sold paths land here. Klaviyo needs the same change.
  syncListingToKlaviyoCatalogBestEffort(listingId)
  const run = async () => {
    try {
      const result = await syncListingToGoogleMerchant(supabase, listingId)
      if (result.action === "error") {
        console.error("[google-merchant] sync failed", {
          listingId,
          offerId: result.offerId,
          error: result.error,
        })
      }
    } catch (e) {
      console.error("[google-merchant] sync threw", {
        listingId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  try {
    after(run)
  } catch {
    void run()
  }
}

/**
 * Remove a listing from Merchant Center when it is archived, deleted, sold, or otherwise ineligible.
 * Uses the service-role client so removal is reliable after destructive listing mutations.
 */
export async function removeListingFromGoogleMerchantFeed(
  listingId: string,
): Promise<GoogleMerchantSyncListingResult> {
  syncListingToKlaviyoCatalogBestEffort(listingId)
  if (!isGoogleMerchantConfigured()) {
    return { action: "skipped", offerId: listingId }
  }

  try {
    const supabase = createServiceRoleClient()
    const result = await syncListingToGoogleMerchant(supabase, listingId)
    if (result.action === "error") {
      console.error("[google-merchant] feed removal failed", {
        listingId,
        offerId: result.offerId,
        error: result.error,
      })
    }
    return result
  } catch (e) {
    console.error("[google-merchant] feed removal threw", {
      listingId,
      error: e instanceof Error ? e.message : String(e),
    })
    return { action: "skipped", offerId: listingId }
  }
}

async function syncShippableSurfboardDataSource(
  listing: GoogleMerchantListingRow | null,
  listingId: string,
  context: GoogleMerchantProductInputContext,
): Promise<void> {
  if (!isGoogleMerchantShippableSurfboardsFeedConfigured()) return

  const dataSource = getGoogleMerchantShippableSurfboardsDataSourceName()
  const feedLabel = getGoogleMerchantShippableSurfboardsFeedLabel()
  if (!dataSource) return

  const target = { dataSource, feedLabel }
  const eligible = listing != null && isShippableSurfboardGoogleMerchantListing(listing)
  const productInput = eligible
    ? mapListingToProductInput(listing, context, {
        feedLabel,
        customLabel2: GOOGLE_MERCHANT_SHIPPING_CUSTOM_LABEL,
      })
    : null

  if (!productInput) {
    const deleted = await deleteGoogleMerchantProductInput(listingId, target)
    if (!deleted.ok && deleted.status !== 404) {
      console.error("[google-merchant] shippable feed delete failed", {
        listingId,
        error: deleted.error,
      })
    }
    return
  }

  const inserted = await insertGoogleMerchantProductInput(productInput, { dataSource })
  if (!inserted.ok) {
    console.error("[google-merchant] shippable feed insert failed", {
      listingId,
      error: inserted.error,
    })
  }
}

export async function syncListingToGoogleMerchant(
  supabase: SupabaseClient,
  listingId: string,
): Promise<GoogleMerchantSyncListingResult> {
  const primaryConfigured = isGoogleMerchantConfigured()
  const shippableConfigured = isGoogleMerchantShippableSurfboardsFeedConfigured()
  if (!primaryConfigured && !shippableConfigured) {
    return { action: "skipped", offerId: listingId }
  }

  const listing = await getGoogleMerchantListingById(supabase, listingId)
  const context = await googleMerchantProductInputContext(supabase)

  let result: GoogleMerchantSyncListingResult = { action: "skipped", offerId: listingId }

  if (primaryConfigured) {
    if (!listing) {
      const deleted = await deleteGoogleMerchantProductInput(listingId)
      result =
        !deleted.ok && deleted.status !== 404
          ? { action: "error", offerId: listingId, error: deleted.error }
          : { action: "deleted", offerId: listingId }
    } else {
      const productInput = mapListingToProductInput(listing, context)
      if (!productInput) {
        const deleted = await deleteGoogleMerchantProductInput(listing.id)
        result =
          !deleted.ok && deleted.status !== 404
            ? { action: "error", offerId: listing.id, error: deleted.error }
            : { action: "deleted", offerId: listing.id }
      } else {
        const inserted = await insertGoogleMerchantProductInput(productInput)
        result = inserted.ok
          ? { action: "inserted", offerId: listing.id }
          : { action: "error", offerId: listing.id, error: inserted.error }
      }
    }
  }

  await syncShippableSurfboardDataSource(listing, listingId, context)
  return result
}

export type GoogleMerchantBulkSyncSummary = {
  processed: number
  inserted: number
  deleted: number
  skipped: number
  errors: number
  reconciled_checked: number
  reconciled_deleted: number
  reconciled_errors: number
  shippable_inserted: number
  shippable_deleted: number
  shippable_errors: number
  error_samples: Array<{ offerId: string; error: string }>
}

async function collectEligibleOfferIds(supabase: SupabaseClient): Promise<Set<string>> {
  const offerIds = new Set<string>()
  const pageSize = 100
  let from = 0

  for (;;) {
    const batch = await listGoogleMerchantListingBatch(supabase, { from, limit: pageSize })
    if (batch.length === 0) break

    for (const listing of batch) {
      if (isGoogleMerchantEligibleListing(listing)) {
        offerIds.add(listing.id)
      }
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  return offerIds
}

async function reconcileGoogleMerchantOrphans(
  eligibleOfferIds: Set<string>,
  summary: GoogleMerchantBulkSyncSummary,
): Promise<void> {
  const listed = await listAllGoogleMerchantProducts()
  if (!listed.ok) {
    summary.reconciled_errors += 1
    if (summary.error_samples.length < 10) {
      summary.error_samples.push({ offerId: "*", error: listed.error })
    }
    return
  }

  summary.reconciled_checked = listed.products.length

  for (const product of listed.products) {
    if (eligibleOfferIds.has(product.offerId)) continue

    const deleted = await deleteGoogleMerchantProductInput(product.offerId)
    if (deleted.ok || deleted.status === 404) {
      summary.reconciled_deleted += 1
      continue
    }

    summary.reconciled_errors += 1
    if (summary.error_samples.length < 10) {
      summary.error_samples.push({ offerId: product.offerId, error: deleted.error })
    }
  }
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
    reconciled_checked: 0,
    reconciled_deleted: 0,
    reconciled_errors: 0,
    shippable_inserted: 0,
    shippable_deleted: 0,
    shippable_errors: 0,
    error_samples: [],
  }

  if (!isGoogleMerchantConfigured() && !isGoogleMerchantShippableSurfboardsFeedConfigured()) {
    return summary
  }

  const context = await googleMerchantProductInputContext(supabase)

  if (!isGoogleMerchantConfigured()) {
    await syncAllShippableSurfboards(supabase, context, summary)
    return summary
  }

  const eligibleOfferIds = await collectEligibleOfferIds(supabase)
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

      const productInput = mapListingToProductInput(listing, context)
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

  await reconcileGoogleMerchantOrphans(eligibleOfferIds, summary)
  await syncAllShippableSurfboards(supabase, context, summary)

  return summary
}

async function syncAllShippableSurfboards(
  supabase: SupabaseClient,
  context: GoogleMerchantProductInputContext,
  summary: GoogleMerchantBulkSyncSummary,
): Promise<void> {
  if (!isGoogleMerchantShippableSurfboardsFeedConfigured()) return

  const dataSource = getGoogleMerchantShippableSurfboardsDataSourceName()
  const feedLabel = getGoogleMerchantShippableSurfboardsFeedLabel()
  if (!dataSource) return

  const eligibleOfferIds = new Set<string>()
  const pageSize = 100
  let from = 0

  for (;;) {
    const batch = await listShippableSurfboardMerchantListingBatch(supabase, { from, limit: pageSize })
    if (batch.length === 0) break

    for (const listing of batch) {
      if (!isShippableSurfboardGoogleMerchantListing(listing)) continue
      const productInput = mapListingToProductInput(listing, context, {
        feedLabel,
        customLabel2: GOOGLE_MERCHANT_SHIPPING_CUSTOM_LABEL,
      })
      if (!productInput) continue
      eligibleOfferIds.add(listing.id)
      const inserted = await insertGoogleMerchantProductInput(productInput, { dataSource })
      if (inserted.ok) {
        summary.shippable_inserted += 1
      } else {
        summary.shippable_errors += 1
        if (summary.error_samples.length < 10) {
          summary.error_samples.push({ offerId: listing.id, error: inserted.error })
        }
      }
    }

    if (batch.length < pageSize) break
    from += pageSize
  }

  const listed = await listAllGoogleMerchantProducts({
    match: (product) =>
      matchesGoogleMerchantFeedProduct(product, {
        feedLabel,
        dataSourceName: dataSource,
      }),
  })
  if (!listed.ok) {
    summary.shippable_errors += 1
    if (summary.error_samples.length < 10) {
      summary.error_samples.push({ offerId: "*", error: listed.error })
    }
    return
  }

  for (const product of listed.products) {
    if (eligibleOfferIds.has(product.offerId)) continue
    const deleted = await deleteGoogleMerchantProductInput(product.offerId, { dataSource, feedLabel })
    if (deleted.ok || deleted.status === 404) {
      summary.shippable_deleted += 1
      continue
    }
    summary.shippable_errors += 1
    if (summary.error_samples.length < 10) {
      summary.error_samples.push({ offerId: product.offerId, error: deleted.error })
    }
  }
}
