import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"

type LifecycleResult = { ok: true } | { ok: false; error: string; status: number }

type ConsignmentListingRow = {
  id: string
  slug: string | null
  status: string
  consignment_store_id: string | null
}

async function loadStaffConsignmentListing(
  service: ReturnType<typeof createServiceRoleClient>,
  listingId: string,
  staffProfileId: string,
): Promise<{ ok: true; listing: ConsignmentListingRow } | { ok: false; error: string; status: number }> {
  const { data, error } = await service
    .from("listings")
    .select("id, slug, status, consignment_store_id")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Listing not found.", status: 404 }
  }
  const listing = data as ConsignmentListingRow
  if (!listing.consignment_store_id) {
    return { ok: false, error: "This isn't a consigned listing.", status: 400 }
  }
  const role = await getStoreStaffRole(service, listing.consignment_store_id, staffProfileId)
  if (role !== "owner" && role !== "manager") {
    return { ok: false, error: "Only owners and managers can do that.", status: 403 }
  }
  return { ok: true, listing }
}

/** Take a consigned board off sale and return it to the consignor. No money moves. */
export async function withdrawConsignmentListing(input: {
  staffProfileId: string
  listingId: string
}): Promise<LifecycleResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const loaded = await loadStaffConsignmentListing(service, input.listingId, input.staffProfileId)
  if (!loaded.ok) return loaded
  const { listing } = loaded

  if (listing.status === "sold") {
    return { ok: false, error: "Sold boards can't be withdrawn.", status: 409 }
  }

  const { error: updErr } = await service
    .from("listings")
    .update({
      status: "removed",
      intake_status: "withdrawn",
      hidden_from_site: true,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id)

  if (updErr) {
    console.error("[consignmentLifecycle] withdraw failed", { listingId: listing.id, updErr })
    return { ok: false, error: "Could not withdraw the board.", status: 500 }
  }

  await service
    .from("consignment_intakes")
    .update({ status: "withdrawn", updated_at: new Date().toISOString() })
    .eq("listing_id", listing.id)
    .eq("status", "active")

  try {
    await syncListingToIndex(service, listing.id)
  } catch {
    // ES best-effort.
  }
  revalidateBoardsBrowseCatalog()
  revalidateListingDetailPage(listing.id, listing.slug ?? null)

  return { ok: true }
}

/**
 * Record a sale that happened off Reswell. Marks the board sold at the recorded price for inventory
 * and history. Deliberately creates NO order, payout, or wallet entry — the cash never passed
 * through Reswell, so the shop settles the consignor directly off-platform.
 */
export async function recordOffPlatformSale(input: {
  staffProfileId: string
  listingId: string
  salePrice: number
}): Promise<LifecycleResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const loaded = await loadStaffConsignmentListing(service, input.listingId, input.staffProfileId)
  if (!loaded.ok) return loaded
  const { listing } = loaded

  if (listing.status !== "active") {
    return { ok: false, error: "Only active boards can be recorded as sold.", status: 409 }
  }

  const { error: updErr } = await service
    .from("listings")
    .update({
      status: "sold",
      price: input.salePrice,
      updated_at: new Date().toISOString(),
    })
    .eq("id", listing.id)

  if (updErr) {
    console.error("[consignmentLifecycle] off-platform sale failed", { listingId: listing.id, updErr })
    return { ok: false, error: "Could not record the sale.", status: 500 }
  }

  try {
    await syncListingToIndex(service, listing.id)
  } catch {
    // ES best-effort.
  }
  revalidateBoardsBrowseCatalog()
  revalidateListingDetailPage(listing.id, listing.slug ?? null)

  return { ok: true }
}
