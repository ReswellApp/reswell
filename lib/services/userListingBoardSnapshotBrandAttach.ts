import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

const uuid = z.string().uuid()

/**
 * Links a catalog brand to a board snapshot and the underlying listing (service role).
 * Does not run when the snapshot is already converted to a variant.
 */
export async function attachCatalogBrandToUserListingBoardSnapshotService(
  service: SupabaseClient,
  snapshotId: string,
  brandId: string,
): Promise<
  | { ok: true; brand: { id: string; name: string; slug: string }; listingId: string }
  | { ok: false; error: string; status: number }
> {
  const sidParsed = uuid.safeParse(snapshotId.trim())
  const bidParsed = uuid.safeParse(brandId.trim())
  if (!sidParsed.success || !bidParsed.success) {
    return { ok: false, error: "Invalid id", status: 400 }
  }
  const sid = sidParsed.data
  const bid = bidParsed.data

  const { data: snap, error: snapErr } = await service
    .from("user_listing_board_model_data")
    .select("id, listing_id, converted_brand_model_variant_id")
    .eq("id", sid)
    .maybeSingle()

  if (snapErr || !snap) {
    return { ok: false, error: "Snapshot not found", status: 404 }
  }
  if (snap.converted_brand_model_variant_id) {
    return { ok: false, error: "This snapshot was already converted", status: 400 }
  }

  const { data: brand, error: brandErr } = await service
    .from("brands")
    .select("id, name, slug")
    .eq("id", bid)
    .maybeSingle()

  if (brandErr || !brand) {
    return { ok: false, error: "Brand not found", status: 404 }
  }

  const now = new Date().toISOString()

  const { data: snapUpdated, error: snapUpdErr } = await service
    .from("user_listing_board_model_data")
    .update({
      brand_id: brand.id,
      catalog_brand_slug: brand.slug,
    })
    .eq("id", sid)
    .is("converted_brand_model_variant_id", null)
    .select("id")
    .maybeSingle()

  if (snapUpdErr) {
    console.error("attachCatalogBrand snapshot:", snapUpdErr.message)
    return { ok: false, error: snapUpdErr.message, status: 500 }
  }
  if (!snapUpdated?.id) {
    return { ok: false, error: "Snapshot not found or no longer eligible", status: 409 }
  }

  const { error: listingErr } = await service
    .from("listings")
    .update({
      brand_id: brand.id,
      brand: brand.name,
      updated_at: now,
    })
    .eq("id", snap.listing_id)

  if (listingErr) {
    console.error("attachCatalogBrand listing:", listingErr.message)
    await service
      .from("user_listing_board_model_data")
      .update({
        brand_id: null,
        catalog_brand_slug: null,
      })
      .eq("id", sid)
    return { ok: false, error: "Listing update failed; snapshot brand link was reverted", status: 500 }
  }

  return {
    ok: true,
    brand: { id: brand.id, name: brand.name, slug: brand.slug },
    listingId: snap.listing_id,
  }
}
