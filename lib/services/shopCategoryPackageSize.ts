import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { LISTING_QUICK_EDIT_STATUSES } from "@/lib/listing-quick-edit-access"
import { saveShopCategoryPackageSize } from "@/lib/db/shopCategoryPackageSizes"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { isPeerListingSection, type PeerListingSection } from "@/lib/peer-listing-sections"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import {
  isShopPackageSizeId,
  listingPackageColumnsForShopSize,
  type ListingPackageColumns,
  type ShopCategoryPackageSizeMap,
  type ShopPackageSizeId,
} from "@/lib/shop-category-package-sizes"

type UpdatedListing = { id: string; slug: string | null }

function runAfterResponse(work: () => Promise<void>): void {
  const run = () => {
    void work().catch((error) => {
      console.error(
        "[shopCategoryPackageSize] after-write work:",
        error instanceof Error ? error.message : error,
      )
    })
  }
  try {
    after(run)
  } catch {
    run()
  }
}

export async function setShopCategoryPackageSizeForSeller(params: {
  supabase: SupabaseClient
  userId: string
  section: PeerListingSection
  packageSizeId: string
}): Promise<
  | {
      ok: true
      sizes: ShopCategoryPackageSizeMap
      updatedCount: number
      columns: ListingPackageColumns
    }
  | { ok: false; error: string; status: number }
> {
  if (!isPeerListingSection(params.section) || !isShopPackageSizeId(params.packageSizeId)) {
    return { ok: false, error: "That package size is not available for this category.", status: 400 }
  }
  const packageSizeId: ShopPackageSizeId = params.packageSizeId
  const columns = listingPackageColumnsForShopSize(params.section, packageSizeId)
  if (!columns) {
    return { ok: false, error: "That package size is not available for this category.", status: 400 }
  }

  const saved = await saveShopCategoryPackageSize(
    params.supabase,
    params.userId,
    params.section,
    packageSizeId,
  )
  if (!saved.ok) return { ok: false, error: saved.message, status: 500 }

  const { data, error } = await params.supabase
    .from("listings")
    .update({
      ...columns,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", params.userId)
    .eq("section", params.section)
    .neq("inventory_source", "shopify")
    .is("archived_at", null)
    .in("status", [...LISTING_QUICK_EDIT_STATUSES])
    .select("id, slug")

  if (error) {
    console.error("[shopCategoryPackageSize] apply listings", error.message)
    return { ok: false, error: "Saved the shop default, but listings could not be updated.", status: 500 }
  }

  const updated = (data ?? []) as UpdatedListing[]
  if (updated.length > 0) {
    try {
      await revalidateSellersAfterListingChange(params.supabase, params.userId)
    } catch (revalidateError) {
      console.error(
        "[shopCategoryPackageSize] revalidate seller",
        revalidateError instanceof Error ? revalidateError.message : revalidateError,
      )
    }
    for (const listing of updated) {
      revalidateListingDetailPage(listing.id, listing.slug)
    }
    if (params.section === "surfboards") revalidateBoardsBrowseCatalog()

    const ids = updated.map((listing) => listing.id)
    runAfterResponse(async () => {
      for (const listingId of ids) {
        try {
          await syncListingToIndex(params.supabase, listingId)
        } catch (syncError) {
          console.error(
            "[shopCategoryPackageSize] elasticsearch",
            syncError instanceof Error ? syncError.message : syncError,
          )
        }
        syncListingToGoogleMerchantBestEffort(params.supabase, listingId)
      }
    })
  }

  return { ok: true, sizes: saved.sizes, updatedCount: updated.length, columns }
}
