import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  getConsignmentStoreById,
  getConsignmentStoreBySlug,
  getStoreStaffRole,
} from "@/lib/db/consignmentStores"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

export type AttachShopOwnedListingResult =
  | { ok: true; listingId: string }
  | { ok: false; error: string; status: number }

type ListingAttachRow = {
  id: string
  slug: string | null
  user_id: string
  status: string
  consignment_store_id: string | null
  consignor_profile_id: string | null
  hidden_from_site: boolean | null
}

/**
 * Links a shop-owner listing to their store floor inventory (shop-owned, not consignment).
 * The listing stays on the shop's seller account; `consignor_profile_id` stays null.
 */
export async function attachListingAsShopOwnedInventory(
  staffProfileId: string,
  input: { listingId: string; storeId: string },
): Promise<AttachShopOwnedListingResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreById(service, input.storeId)
  if (!store) {
    return { ok: false, error: "Store not found", status: 404 }
  }
  if (store.status !== "active") {
    return { ok: false, error: "Store is not active.", status: 409 }
  }

  const role = await getStoreStaffRole(service, store.id, staffProfileId)
  if (role !== "owner" && role !== "manager") {
    return {
      ok: false,
      error: "Only store owners and managers can add shop inventory.",
      status: 403,
    }
  }

  const { data: listingRaw, error: listingErr } = await service
    .from("listings")
    .select(
      "id, slug, user_id, status, consignment_store_id, consignor_profile_id, hidden_from_site",
    )
    .eq("id", input.listingId)
    .maybeSingle()

  if (listingErr || !listingRaw) {
    return { ok: false, error: "Listing not found.", status: 404 }
  }
  const listing = listingRaw as ListingAttachRow

  if (listing.user_id !== store.ownerProfileId) {
    return {
      ok: false,
      error: "Shop inventory must be listed on the store owner's seller account.",
      status: 403,
    }
  }
  if (listing.consignor_profile_id) {
    return { ok: false, error: "Consignment boards can't be re-tagged as shop inventory.", status: 409 }
  }
  if (listing.consignment_store_id && listing.consignment_store_id !== store.id) {
    return { ok: false, error: "This listing belongs to another store.", status: 409 }
  }
  if (listing.consignment_store_id === store.id) {
    return { ok: true, listingId: listing.id }
  }
  if (listing.status !== "active" || listing.hidden_from_site) {
    return { ok: false, error: "Publish the listing before adding it to shop inventory.", status: 409 }
  }

  const { error: updErr } = await service
    .from("listings")
    .update({
      consignment_store_id: store.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id)

  if (updErr) {
    console.error("[shopOwnedListing] attach failed", { listingId: listing.id, updErr })
    return { ok: false, error: "Could not add listing to shop inventory.", status: 500 }
  }

  try {
    await syncListingToIndex(service, listing.id)
  } catch {
    // ES best-effort.
  }
  revalidateBoardsBrowseCatalog()
  revalidateListingDetailPage(listing.id, listing.slug ?? null)

  return { ok: true, listingId: listing.id }
}

/** Resolve store by slug then attach — used from the sell flow and store hub. */
export async function attachListingAsShopOwnedInventoryBySlug(
  staffProfileId: string,
  input: { listingId: string; storeSlug: string },
): Promise<AttachShopOwnedListingResult> {
  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const store = await getConsignmentStoreBySlug(service, input.storeSlug)
  if (!store) {
    return { ok: false, error: "Store not found", status: 404 }
  }

  return attachListingAsShopOwnedInventory(staffProfileId, {
    listingId: input.listingId,
    storeId: store.id,
  })
}
