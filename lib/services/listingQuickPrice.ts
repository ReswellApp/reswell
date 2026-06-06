import type { SupabaseClient } from "@supabase/supabase-js"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { patchListingPriceByOwner } from "@/lib/db/listings"

const QUICK_PRICE_ALLOWED_STATUSES = ["active", "pending_sale", "pending", "draft"] as const

type AllowedStatus = (typeof QUICK_PRICE_ALLOWED_STATUSES)[number]

type ListingQuickPriceRow = {
  user_id: string
  status: string
  price: string | number
}

export type UpdateSellerListingQuickPriceResult =
  | { ok: true; priceUsd: number }
  | { ok: false; status: number; error: string }

export function roundUsdTwoDecimals(n: number): number {
  return Math.round(n * 100) / 100
}

async function loadListingQuickPriceRow(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingQuickPriceRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("user_id, status, price")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingQuickPriceRow
}

/**
 * Lets the listing owner change list price without opening the full sell editor.
 */
export async function updateSellerListingQuickPrice(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string; priceUsd: number },
): Promise<UpdateSellerListingQuickPriceResult> {
  const { listingId, sellerUserId, priceUsd } = params

  const row = await loadListingQuickPriceRow(supabase, listingId)
  if (!row) {
    return { ok: false, status: 404, error: "Listing not found" }
  }

  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const status = typeof row.status === "string" ? row.status.trim() : ""
  if (!QUICK_PRICE_ALLOWED_STATUSES.includes(status as AllowedStatus)) {
    return {
      ok: false,
      status: 409,
      error: "This listing can’t be price-edited here. Use Edit listing.",
    }
  }

  const nextUsd = roundUsdTwoDecimals(priceUsd)
  const currentRaw = row.price
  const currentNum =
    typeof currentRaw === "number" ? currentRaw : Number.parseFloat(String(currentRaw ?? ""))
  const currentUsd = Number.isFinite(currentNum) ? roundUsdTwoDecimals(currentNum) : NaN

  if (!Number.isFinite(currentUsd)) {
    return { ok: false, status: 400, error: "Current listing price is invalid." }
  }

  if (nextUsd === currentUsd) {
    return { ok: true, priceUsd: nextUsd }
  }

  const patched = await patchListingPriceByOwner(supabase, {
    listingId,
    ownerUserId: sellerUserId,
    priceUsd: nextUsd,
    allowedStatuses: [...QUICK_PRICE_ALLOWED_STATUSES],
  })

  if (!patched.ok) {
    if (patched.kind === "update_failed") {
      return { ok: false, status: 500, error: "Could not update price." }
    }
    return {
      ok: false,
      status: 409,
      error: "That listing can’t be updated here. Try Edit listing.",
    }
  }

  try {
    await syncListingToIndex(supabase, listingId)
  } catch {
    // ES optional
  }

  void syncListingToGoogleMerchantBestEffort(supabase, listingId)
  await revalidateSellersAfterListingChange(supabase, sellerUserId)

  return { ok: true, priceUsd: nextUsd }
}
