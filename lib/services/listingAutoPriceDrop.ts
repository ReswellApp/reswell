import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import {
  applyListingAutoPriceDropPatch,
  clearListingAutoPriceDropFloor,
  listDueAutoPriceDropListings,
  type DueAutoPriceDropListingRow,
} from "@/lib/db/listingAutoPriceDrop"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { notifyFollowersOfPriceDrop } from "@/lib/follows/notify-followers"
import { planListingAutoPriceDrop } from "@/lib/listing-auto-price-drop"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { notifyKlaviyoFavoritePriceDrop } from "@/lib/services/klaviyoFavoritePriceDrop"

export type ListingAutoPriceDropSummary = {
  scanned: number
  dropped: number
  cleared: number
  skipped: number
  failed: number
  errors: Array<{ listingId: string; error: string }>
}

const MAX_ERROR_SAMPLES = 10

export async function applyDueListingAutoPriceDrops(
  supabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<ListingAutoPriceDropSummary> {
  const due = await listDueAutoPriceDropListings(supabase, referenceTime)

  const summary: ListingAutoPriceDropSummary = {
    scanned: due.length,
    dropped: 0,
    cleared: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  }

  for (const row of due) {
    try {
      const result = await applyOneDueListingAutoPriceDrop(supabase, row, referenceTime)
      if (result === "dropped") summary.dropped += 1
      else if (result === "cleared") summary.cleared += 1
      else if (result === "skipped") summary.skipped += 1
      else {
        summary.failed += 1
        if (summary.errors.length < MAX_ERROR_SAMPLES) {
          summary.errors.push({ listingId: row.id, error: result.error })
        }
      }
    } catch (error) {
      summary.failed += 1
      if (summary.errors.length < MAX_ERROR_SAMPLES) {
        const message = error instanceof Error ? error.message : String(error)
        summary.errors.push({ listingId: row.id, error: message })
      }
    }
  }

  return summary
}

async function applyOneDueListingAutoPriceDrop(
  supabase: SupabaseClient,
  row: DueAutoPriceDropListingRow,
  referenceTime: Date,
): Promise<"dropped" | "cleared" | "skipped" | { error: string }> {
  const plan = planListingAutoPriceDrop({
    status: row.status,
    priceUsd: row.price,
    compareAtPriceUsd: row.compare_at_price,
    floorUsd: row.auto_price_drop_floor,
    scheduledFor: row.auto_price_drop_scheduled_for,
    referenceTime,
  })

  if (plan.action === "skip") return "skipped"

  if (plan.action === "clear") {
    const cleared = await clearListingAutoPriceDropFloor(supabase, row.id)
    if (!cleared.ok) return { error: cleared.message }
    return "cleared"
  }

  const currentRaw = row.price
  const currentNum =
    typeof currentRaw === "number" ? currentRaw : Number.parseFloat(String(currentRaw ?? ""))

  const patched = await applyListingAutoPriceDropPatch(supabase, {
    listingId: row.id,
    priceUsd: plan.nextPriceUsd,
    compareAtPriceUsd: plan.compareAtPriceUsd,
    clearFloor: true,
  })
  if (!patched.ok) return { error: patched.message }

  try {
    await syncListingToIndex(supabase, row.id)
  } catch {
    // ES optional
  }

  void syncListingToGoogleMerchantBestEffort(supabase, row.id)
  await revalidateSellersAfterListingChange(supabase, row.user_id)
  revalidateListingDetailPage(row.id, row.slug)
  if (row.section === "surfboards") {
    revalidateBoardsBrowseCatalog()
  }

  if (Number.isFinite(currentNum) && plan.nextPriceUsd < currentNum) {
    void notifyKlaviyoFavoritePriceDrop(supabase, {
      listingId: row.id,
      oldPriceUsd: currentNum,
      newPriceUsd: plan.nextPriceUsd,
    })
    void notifyFollowersOfPriceDrop(supabase, {
      sellerId: row.user_id,
      listingId: row.id,
      listingTitle: row.title?.trim() || "a listing",
      oldPrice: currentNum,
      newPrice: plan.nextPriceUsd,
    })
  }

  return "dropped"
}
