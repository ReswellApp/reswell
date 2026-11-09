import { after } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { revalidateSellersAfterListingChange } from "@/lib/cache/revalidate-sellers-directory-catalog"
import { saveShopShippingDefaults } from "@/lib/db/shopCategoryPackageSizes"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { LISTING_QUICK_EDIT_STATUSES } from "@/lib/listing-quick-edit-access"
import type { ListingPackageColumns, ShopCategoryPackageSizeMap } from "@/lib/shop-category-package-sizes"
import {
  listingPackageColumnsFromRow,
  planShopShippingListingUpdates,
  resolveListingBoardLengthInches,
  shopShippingDefaultsFromDraft,
  type ShopShippingDefaults,
  type ShopShippingDraftInput,
} from "@/lib/shop-shipping-defaults"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"

type UpdatedListing = { id: string; slug: string | null; section: string | null }

export type ShopShippingAppliedGroup = {
  ids: string[]
  columns: ListingPackageColumns
}

function runAfterResponse(work: () => Promise<void>): void {
  const run = () => {
    void work().catch((error) => {
      console.error(
        "[shopShippingDefaults] after-write work:",
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

function chunk<T>(items: T[], size: number): T[][] {
  const groups: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    groups.push(items.slice(index, index + size))
  }
  return groups
}

function groupUpdates(
  updates: { id: string; columns: ListingPackageColumns }[],
): ShopShippingAppliedGroup[] {
  const groups = new Map<string, ShopShippingAppliedGroup>()
  for (const update of updates) {
    const key = JSON.stringify(update.columns)
    const existing = groups.get(key)
    if (existing) existing.ids.push(update.id)
    else groups.set(key, { ids: [update.id], columns: update.columns })
  }
  return [...groups.values()]
}

export async function saveShopShippingDefaultsForSeller(params: {
  supabase: SupabaseClient
  userId: string
  draft: ShopShippingDraftInput
  categoryPresets: ShopCategoryPackageSizeMap
}): Promise<
  | {
      ok: true
      defaults: ShopShippingDefaults
      updatedCount: number
      appliedGroups: ShopShippingAppliedGroup[]
      skippedBecausePackageDoesNotFit: number
    }
  | { ok: false; error: string; status: number }
> {
  const normalized = shopShippingDefaultsFromDraft(params.draft)
  if (!normalized.ok) return { ok: false, error: normalized.error, status: 400 }

  const saved = await saveShopShippingDefaults(params.supabase, params.userId, normalized.defaults)
  if (!saved.ok) return { ok: false, error: saved.message, status: 500 }

  const { data, error } = await params.supabase
    .from("listings")
    .select(
      "id, slug, section, length_total_inches, dimensions, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz, shipping_package_tier, shipping_package_band",
    )
    .eq("user_id", params.userId)
    .neq("inventory_source", "shopify")
    .is("archived_at", null)
    .in("status", [...LISTING_QUICK_EDIT_STATUSES])

  if (error) {
    console.error("[shopShippingDefaults] load listings", error.message)
    return {
      ok: false,
      error: "Saved the shop default, but listings could not be updated.",
      status: 500,
    }
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const plan = planShopShippingListingUpdates({
    defaults: normalized.defaults,
    categoryPresets: params.categoryPresets,
    listings: rows.flatMap((row) => {
      const id = typeof row.id === "string" ? row.id : ""
      const section = typeof row.section === "string" ? row.section : ""
      if (!id || !section) return []
      return [
        {
          id,
          section,
          lengthTotalInches: resolveListingBoardLengthInches({
            length_total_inches: row.length_total_inches,
            dimensions: typeof row.dimensions === "string" ? row.dimensions : null,
          }),
          columns: listingPackageColumnsFromRow(row),
        },
      ]
    }),
  })

  const appliedGroups = groupUpdates(plan.updates)
  const updated: UpdatedListing[] = []
  for (const group of appliedGroups) {
    for (const ids of chunk(group.ids, 80)) {
      const { data: written, error: writeError } = await params.supabase
        .from("listings")
        .update({
          ...group.columns,
          updated_at: new Date().toISOString(),
        })
        .in("id", ids)
        .eq("user_id", params.userId)
        .neq("inventory_source", "shopify")
        .is("archived_at", null)
        .in("status", [...LISTING_QUICK_EDIT_STATUSES])
        .select("id, slug, section")

      if (writeError) {
        console.error("[shopShippingDefaults] apply listings", writeError.message)
        return {
          ok: false,
          error: "Saved the shop default, but listings could not be updated.",
          status: 500,
        }
      }
      updated.push(...((written ?? []) as UpdatedListing[]))
    }
  }

  if (updated.length > 0) {
    try {
      await revalidateSellersAfterListingChange(params.supabase, params.userId)
    } catch (revalidateError) {
      console.error(
        "[shopShippingDefaults] revalidate seller",
        revalidateError instanceof Error ? revalidateError.message : revalidateError,
      )
    }
    for (const listing of updated) {
      revalidateListingDetailPage(listing.id, listing.slug)
    }
    if (updated.some((listing) => listing.section === "surfboards")) revalidateBoardsBrowseCatalog()

    const ids = updated.map((listing) => listing.id)
    runAfterResponse(async () => {
      for (const listingId of ids) {
        try {
          await syncListingToIndex(params.supabase, listingId)
        } catch (syncError) {
          console.error(
            "[shopShippingDefaults] elasticsearch",
            syncError instanceof Error ? syncError.message : syncError,
          )
        }
        syncListingToGoogleMerchantBestEffort(params.supabase, listingId)
      }
    })
  }

  const writtenIds = new Set(updated.map((listing) => listing.id))
  return {
    ok: true,
    defaults: normalized.defaults,
    updatedCount: updated.length,
    appliedGroups: appliedGroups
      .map((group) => ({
        ...group,
        ids: group.ids.filter((id) => writtenIds.has(id)),
      }))
      .filter((group) => group.ids.length > 0),
    skippedBecausePackageDoesNotFit: plan.skippedBecausePackageDoesNotFit,
  }
}
