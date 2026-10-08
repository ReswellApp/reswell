import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"
import { getDb } from "@/lib/supabase/db"
import type { ListingImageForCard } from "@/lib/listing-image-display"

export type MobileListingSellerRow = {
  seller_slug?: string | null
  display_name?: string | null
}

export type MobileListingRow = {
  id: string
  slug: string | null
  title: string | null
  description: string | null
  status: string
  price: number | string | null
  condition: string | null
  section: string | null
  brand: string | null
  model: string | null
  board_type: string | null
  dimensions: string | null
  city: string | null
  state: string | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  hidden_from_site: boolean | null
  archived_at: string | null
  shipping_price: number | string | null
  board_shipping_cost_mode: string | null
  listing_images: ListingImageForCard[] | null
  profiles: MobileListingSellerRow | MobileListingSellerRow[] | null
}

export const MOBILE_LISTING_SELECT = `
  id,
  slug,
  title,
  description,
  status,
  price,
  condition,
  section,
  brand,
  model,
  board_type,
  dimensions,
  city,
  state,
  shipping_available,
  local_pickup,
  shipping_price,
  board_shipping_cost_mode,
  hidden_from_site,
  archived_at,
  listing_images (url, thumbnail_url, is_primary, sort_order),
  ${LISTING_SELLER_PROFILES_EMBED} (seller_slug, display_name)
`

export async function listMobileListingRows(
  limit: number,
  offset: number,
): Promise<{ ok: true; rows: MobileListingRow[]; hasMore: boolean } | { ok: false; message: string }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { data, error } = await supabase
    .from("listings")
    .select(MOBILE_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .not("title", "ilike", "admin seed%")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(offset, offset + limit)

  if (error) {
    return { ok: false, message: error.message }
  }

  const rows = (data ?? []) as MobileListingRow[]
  const hasMore = rows.length > limit
  return { ok: true, rows: hasMore ? rows.slice(0, limit) : rows, hasMore }
}
