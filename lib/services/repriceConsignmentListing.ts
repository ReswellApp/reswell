import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

type RepriceResult = { ok: true; price: number } | { ok: false; error: string; status: number }

/**
 * Shop re-prices an active consigned board. Per the consignment terms a shop may mark a board down
 * (or up) on its own — but never below the consignor's floor, which protects the consignor's agreed
 * minimum. Owners and managers can re-price; clerks cannot.
 */
export async function repriceConsignmentListing(input: {
  staffProfileId: string
  listingId: string
  price: number
}): Promise<RepriceResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data, error } = await service
    .from("listings")
    .select("id, slug, status, floor_price, consignment_store_id")
    .eq("id", input.listingId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Listing not found.", status: 404 }
  }

  const listing = data as {
    id: string
    slug: string | null
    status: string
    floor_price: number | string | null
    consignment_store_id: string | null
  }

  if (!listing.consignment_store_id) {
    return { ok: false, error: "This isn't a consigned listing.", status: 400 }
  }

  const role = await getStoreStaffRole(service, listing.consignment_store_id, input.staffProfileId)
  if (role !== "owner" && role !== "manager") {
    return { ok: false, error: "Only owners and managers can re-price boards.", status: 403 }
  }

  if (listing.status !== "active") {
    return { ok: false, error: "Only active listings can be re-priced.", status: 409 }
  }

  const floor = listing.floor_price == null ? null : Number(listing.floor_price)
  if (floor != null && Number.isFinite(floor) && input.price < floor) {
    return {
      ok: false,
      error: `Price can't go below the consignor's floor of $${floor.toFixed(2)}.`,
      status: 400,
    }
  }

  const { error: updErr } = await service
    .from("listings")
    .update({ price: input.price, updated_at: new Date().toISOString() })
    .eq("id", listing.id)

  if (updErr) {
    console.error("[repriceConsignmentListing] update failed", { listingId: listing.id, updErr })
    return { ok: false, error: "Could not update the price.", status: 500 }
  }

  try {
    await syncListingToIndex(service, listing.id)
  } catch {
    // ES best-effort.
  }
  revalidateBoardsBrowseCatalog()
  revalidateListingDetailPage(listing.id, listing.slug ?? null)

  return { ok: true, price: input.price }
}
