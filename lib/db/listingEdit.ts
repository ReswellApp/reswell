import type { SupabaseClient } from "@supabase/supabase-js"

export type OwnedListingImageRow = {
  id: string
  url: string | null
  thumbnail_url?: string | null
  is_primary?: boolean | null
  sort_order?: number | null
}

export type OwnedListingVideoRow = {
  id: string
  url: string
  thumbnail_url?: string | null
  content_type?: string | null
  duration_seconds?: number | null
  byte_size?: number | null
  sort_order?: number | null
}

/** Listing row shape returned for sell-flow edit hydration. */
export type OwnedListingForEditRow = {
  id: string
  user_id: string
  section?: string | null
  status?: string | null
  slug?: string | null
  title?: string | null
  description?: string | null
  price?: number | string | null
  condition?: string | null
  city?: string | null
  state?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  shipping_price?: number | string | null
  board_shipping_cost_mode?: string | null
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  shipping_package_tier?: string | null
  shipping_package_band?: string | null
  brand?: string | null
  model?: string | null
  buyer_offers_enabled?: boolean | null
  seller_purchase_price_usd?: number | string | null
  wetsuit_size?: string | null
  apparel_kind?: string | null
  apparel_size?: string | null
  fin_setup?: string | null
  fin_system?: string | null
  construction?: string | null
  fins_setup?: string | null
  fins_included?: boolean | null
  size?: string | null
  brand_id?: string | null
  brand_model_id?: string | null
  category_id?: string | null
  board_type?: string | null
  listing_images?: OwnedListingImageRow[] | null
  listing_videos?: OwnedListingVideoRow[] | null
  user_listing_board_model_data?:
    | {
        model_name?: string | null
        catalog_model_slug?: string | null
        catalog_brand_slug?: string | null
      }
    | Array<{
        model_name?: string | null
        catalog_model_slug?: string | null
        catalog_brand_slug?: string | null
      }>
    | null
  brand_models?:
    | {
        id?: string
        name?: string | null
        brands?: { slug?: string | null } | Array<{ slug?: string | null }> | null
      }
    | Array<{
        id?: string
        name?: string | null
        brands?: { slug?: string | null } | Array<{ slug?: string | null }> | null
      }>
    | null
}

const LISTING_FOR_EDIT_SELECT = `
  *,
  listing_images (id, url, thumbnail_url, is_primary, sort_order),
  listing_videos (id, url, thumbnail_url, content_type, duration_seconds, byte_size, sort_order),
  user_listing_board_model_data ( model_name, catalog_model_slug, catalog_brand_slug ),
  brand_models ( id, name, brands ( slug ) )
`

/** Listing row + images for the sell-flow edit hydrator (owner-scoped). */
export async function fetchOwnedListingForEdit(
  supabase: SupabaseClient,
  listingId: string,
  userId: string,
): Promise<OwnedListingForEditRow | null> {
  const trimmed = listingId.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_FOR_EDIT_SELECT)
    .eq("id", trimmed)
    .eq("user_id", userId)
    .maybeSingle()

  if (error || !data?.id) return null
  return data as OwnedListingForEditRow
}

/** Listing row by id only — admin / service-role edit hydration. */
export async function fetchListingForEditById(
  supabase: SupabaseClient,
  listingId: string,
): Promise<OwnedListingForEditRow | null> {
  const trimmed = listingId.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_FOR_EDIT_SELECT)
    .eq("id", trimmed)
    .maybeSingle()

  if (error || !data?.id) return null
  return data as OwnedListingForEditRow
}
