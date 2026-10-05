import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import {
  loadListingQuickEditRow,
  patchListingQuickFieldsByOwner,
  type ListingQuickEditRow,
  type ListingQuickFieldPatch,
} from "@/lib/db/listingQuickEdit"
import { LISTING_QUICK_EDIT_STATUSES } from "@/lib/listing-quick-edit-access"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import { roundUsdTwoDecimals, updateSellerListingQuickPrice } from "@/lib/services/listingQuickPrice"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import {
  inferShopPackageSizeId,
  isShopPackageSizeAllowed,
  listingPackageColumnsForShopSize,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"
import type { ListingQuickEditBody } from "@/lib/validations/listing-quick-edit"

export type ListingQuickEditSaved = {
  title: string
  description: string
  condition: string | null
  priceUsd: number
  compareAtPriceUsd: number | null
  packageSizeId: ShopPackageSizeId | "custom" | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
}

export type UpdateListingQuickEditResult =
  | { ok: true; listing: ListingQuickEditSaved }
  | { ok: false; status: number; error: string }

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null || value === "") return null
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : null
}

function savedFromRow(
  row: ListingQuickEditRow,
  priceUsd: number,
  compareAtPriceUsd: number | null,
): ListingQuickEditSaved {
  const section = row.section ?? ""
  return {
    title: (row.title ?? "").trim(),
    description: (row.description ?? "").trim(),
    condition: row.condition,
    priceUsd,
    compareAtPriceUsd,
    packageSizeId: inferShopPackageSizeId({
      section,
      shipping_package_tier: row.shipping_package_tier,
      shipping_package_band: row.shipping_package_band,
      shipping_packed_length_in: toNumber(row.shipping_packed_length_in),
      shipping_packed_width_in: toNumber(row.shipping_packed_width_in),
      shipping_packed_height_in: toNumber(row.shipping_packed_height_in),
      shipping_packed_weight_oz: toNumber(row.shipping_packed_weight_oz),
    }),
    shipping_package_tier: row.shipping_package_tier,
    shipping_package_band: row.shipping_package_band,
    shipping_packed_length_in: toNumber(row.shipping_packed_length_in),
    shipping_packed_width_in: toNumber(row.shipping_packed_width_in),
    shipping_packed_height_in: toNumber(row.shipping_packed_height_in),
    shipping_packed_weight_oz: toNumber(row.shipping_packed_weight_oz),
  }
}

function packageColumnsFromRow(row: ListingQuickEditRow) {
  return {
    shipping_package_tier: row.shipping_package_tier,
    shipping_package_band: row.shipping_package_band,
    shipping_packed_length_in: toNumber(row.shipping_packed_length_in),
    shipping_packed_width_in: toNumber(row.shipping_packed_width_in),
    shipping_packed_height_in: toNumber(row.shipping_packed_height_in),
    shipping_packed_weight_oz: toNumber(row.shipping_packed_weight_oz),
  }
}

export async function updateSellerListingQuickEdit(
  supabase: SupabaseClient,
  params: { sellerUserId: string } & ListingQuickEditBody,
): Promise<UpdateListingQuickEditResult> {
  const row = await loadListingQuickEditRow(supabase, params.listingId)
  if (!row) return { ok: false, status: 404, error: "Listing not found" }
  if (row.user_id !== params.sellerUserId) {
    return { ok: false, status: 403, error: "You can only edit your own listings." }
  }
  if (row.archived_at) {
    return { ok: false, status: 409, error: "Archived listings can’t be edited here." }
  }

  const status = typeof row.status === "string" ? row.status.trim() : ""
  if (!(LISTING_QUICK_EDIT_STATUSES as readonly string[]).includes(status)) {
    return { ok: false, status: 409, error: "This listing can’t be edited here. Open the full editor." }
  }

  const section = row.section ?? ""
  const patch: ListingQuickFieldPatch = {}

  if (params.title !== undefined) {
    const nextTitle = params.title.trim()
    if (nextTitle !== (row.title ?? "").trim()) patch.title = nextTitle
  }
  if (params.description !== undefined) {
    const nextDescription = params.description.trim()
    if (nextDescription !== (row.description ?? "").trim()) patch.description = nextDescription
  }
  if (params.condition !== undefined && params.condition !== row.condition) {
    patch.condition = params.condition
  }

  if (params.packageSizeId !== undefined) {
    if (!isPeerListingSection(section) || !isShopPackageSizeAllowed(section, params.packageSizeId)) {
      return { ok: false, status: 400, error: "That package size doesn’t fit this listing." }
    }
    const columns = listingPackageColumnsForShopSize(section, params.packageSizeId)
    if (!columns) {
      return { ok: false, status: 400, error: "That package size doesn’t fit this listing." }
    }
    const current = packageColumnsFromRow(row)
    const unchanged = (Object.keys(columns) as (keyof typeof columns)[]).every(
      (key) => columns[key] === current[key],
    )
    if (!unchanged) Object.assign(patch, columns)
  }

  const currentPrice = toNumber(row.price)
  const nextPrice =
    params.priceUsd !== undefined ? roundUsdTwoDecimals(params.priceUsd) : null
  const priceChanged =
    nextPrice != null && (currentPrice == null || Math.abs(currentPrice - nextPrice) >= 0.001)

  if (Object.keys(patch).length === 0 && !priceChanged) {
    return {
      ok: true,
      listing: savedFromRow(row, currentPrice ?? 0, toNumber(row.compare_at_price)),
    }
  }

  if (Object.keys(patch).length > 0) {
    const patched = await patchListingQuickFieldsByOwner(supabase, {
      listingId: params.listingId,
      ownerUserId: params.sellerUserId,
      patch,
      allowedStatuses: LISTING_QUICK_EDIT_STATUSES,
    })
    if (!patched.ok) {
      console.error("[listingQuickEdit] patch", patched.message)
      return { ok: false, status: 500, error: "Could not save this listing." }
    }
  }

  let priceUsd = currentPrice ?? 0
  let compareAtPriceUsd = toNumber(row.compare_at_price)
  if (priceChanged && nextPrice != null) {
    const priced = await updateSellerListingQuickPrice(supabase, {
      listingId: params.listingId,
      sellerUserId: params.sellerUserId,
      priceUsd: nextPrice,
    })
    if (!priced.ok) return priced
    priceUsd = priced.priceUsd
    compareAtPriceUsd = priced.compareAtPriceUsd
  }

  const fresh = (await loadListingQuickEditRow(supabase, params.listingId)) ?? row
  if (Object.keys(patch).length > 0) {
    try {
      await syncListingToIndex(supabase, params.listingId)
    } catch {
      // Search index is optional for the save itself.
    }
    syncListingToGoogleMerchantBestEffort(supabase, params.listingId)
    try {
      await revalidateSellersAfterListingChange(supabase, params.sellerUserId)
    } catch (error) {
      console.error(
        "[listingQuickEdit] revalidate seller",
        error instanceof Error ? error.message : error,
      )
    }
    revalidateListingDetailPage(params.listingId, fresh.slug)
    if (fresh.section === "surfboards") revalidateBoardsBrowseCatalog()
  }

  return {
    ok: true,
    listing: savedFromRow(
      {
        ...fresh,
        title: patch.title ?? fresh.title,
        description: patch.description ?? fresh.description,
        condition: patch.condition ?? fresh.condition,
        shipping_package_tier:
          "shipping_package_tier" in patch ? patch.shipping_package_tier ?? null : fresh.shipping_package_tier,
        shipping_package_band:
          "shipping_package_band" in patch ? patch.shipping_package_band ?? null : fresh.shipping_package_band,
        shipping_packed_length_in:
          "shipping_packed_length_in" in patch
            ? patch.shipping_packed_length_in ?? null
            : fresh.shipping_packed_length_in,
        shipping_packed_width_in:
          "shipping_packed_width_in" in patch
            ? patch.shipping_packed_width_in ?? null
            : fresh.shipping_packed_width_in,
        shipping_packed_height_in:
          "shipping_packed_height_in" in patch
            ? patch.shipping_packed_height_in ?? null
            : fresh.shipping_packed_height_in,
        shipping_packed_weight_oz:
          "shipping_packed_weight_oz" in patch
            ? patch.shipping_packed_weight_oz ?? null
            : fresh.shipping_packed_weight_oz,
      },
      priceUsd,
      compareAtPriceUsd,
    ),
  }
}
