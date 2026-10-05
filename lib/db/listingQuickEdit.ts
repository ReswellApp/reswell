import type { SupabaseClient } from "@supabase/supabase-js"
import { LISTING_QUICK_EDIT_STATUSES } from "@/lib/listing-quick-edit-access"
import type { ListingPackageColumns } from "@/lib/shop-category-package-sizes"

export { LISTING_QUICK_EDIT_STATUSES }

export type ListingQuickEditRow = {
  id: string
  user_id: string
  status: string | null
  title: string | null
  description: string | null
  price: string | number | null
  compare_at_price: string | number | null
  condition: string | null
  slug: string | null
  section: string | null
  archived_at: string | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
  shipping_packed_length_in: number | string | null
  shipping_packed_width_in: number | string | null
  shipping_packed_height_in: number | string | null
  shipping_packed_weight_oz: number | string | null
}

const LISTING_QUICK_EDIT_SELECT =
  "id, user_id, status, title, description, price, compare_at_price, condition, slug, section, archived_at, shipping_package_tier, shipping_package_band, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz"

export async function loadListingQuickEditRow(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingQuickEditRow | null> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_QUICK_EDIT_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingQuickEditRow
}

export type ListingQuickFieldPatch = {
  title?: string
  description?: string
  condition?: string
} & Partial<ListingPackageColumns>

export async function patchListingQuickFieldsByOwner(
  supabase: SupabaseClient,
  params: {
    listingId: string
    ownerUserId: string
    patch: ListingQuickFieldPatch
    allowedStatuses: readonly string[]
  },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const update: Record<string, string | number | null> = {
    ...params.patch,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from("listings")
    .update(update)
    .eq("id", params.listingId)
    .eq("user_id", params.ownerUserId)
    .in("status", [...params.allowedStatuses])
    .is("archived_at", null)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, message: error.message }
  if (!data) return { ok: false, message: "Listing not found or it can’t be edited here." }
  return { ok: true }
}
