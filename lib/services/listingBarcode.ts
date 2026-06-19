import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStoreStaffRole } from "@/lib/db/consignmentStores"

type EnsureBarcodeResult =
  | { ok: true; barcode: string; title: string; price: number }
  | { ok: false; error: string; status: number }

function generateBarcode(): string {
  // 12-digit numeric code, "RSW"-free so it scans cleanly into the POS search (which matches barcode).
  let code = ""
  for (let i = 0; i < 12; i++) code += Math.floor(Math.random() * 10).toString()
  return code
}

/**
 * Returns the board's barcode, assigning a fresh one if it doesn't have it yet. Staff-gated (any
 * role can print labels). The POS inventory search matches this code, so a scanned label jumps to
 * the board.
 */
export async function ensureListingBarcode(input: {
  staffProfileId: string
  listingId: string
}): Promise<EnsureBarcodeResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error", status: 503 }
  }

  const { data, error } = await service
    .from("listings")
    .select("id, title, price, barcode, consignment_store_id")
    .eq("id", input.listingId)
    .maybeSingle()

  if (error || !data) {
    return { ok: false, error: "Listing not found.", status: 404 }
  }
  const listing = data as {
    id: string
    title: string | null
    price: number | string
    barcode: string | null
    consignment_store_id: string | null
  }

  if (!listing.consignment_store_id) {
    return { ok: false, error: "This isn't a consigned listing.", status: 400 }
  }
  const role = await getStoreStaffRole(service, listing.consignment_store_id, input.staffProfileId)
  if (!role) {
    return { ok: false, error: "Only store staff can print labels.", status: 403 }
  }

  let barcode = listing.barcode?.trim() || null
  if (!barcode) {
    barcode = generateBarcode()
    const { error: updErr } = await service
      .from("listings")
      .update({ barcode, updated_at: new Date().toISOString() })
      .eq("id", listing.id)
    if (updErr) {
      console.error("[listingBarcode] assign failed", { listingId: listing.id, updErr })
      return { ok: false, error: "Could not assign a barcode.", status: 500 }
    }
  }

  return {
    ok: true,
    barcode,
    title: listing.title ?? "Board",
    price: Number(listing.price),
  }
}
