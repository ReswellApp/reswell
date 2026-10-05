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
  brand: string | null
  model: string | null
  city: string | null
  state: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  dimensions: string | null
  length_total_inches: number | string | null
  volume_liters: number | string | null
  fins_setup: string | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
  tail_shape: string | null
  fin_size: string | null
  wetsuit_size: string | null
  apparel_kind: string | null
  traction_size: string | null
}

const LISTING_QUICK_EDIT_SELECT =
  "id, user_id, status, title, description, price, compare_at_price, condition, slug, section, archived_at, shipping_package_tier, shipping_package_band, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz, brand, model, city, state, local_pickup, shipping_available, dimensions, length_total_inches, volume_liters, fins_setup, fin_system, construction, fins_included, tail_shape, fin_size, wetsuit_size, apparel_kind, traction_size"

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
  brand?: string | null
  model?: string | null
  city?: string | null
  state?: string | null
  local_pickup?: boolean
  shipping_available?: boolean
  dimensions?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  fins_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_included?: boolean | null
  tail_shape?: string | null
  fin_size?: string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  traction_size?: string | null
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
  const update: Record<string, string | number | boolean | null> = {
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
