import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"
import { listingBoardTypeDbValuesForFilter } from "@/lib/board-type-canonical"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { getDb } from "@/lib/supabase/db"
import { categoryIdForBrowseBoardType } from "@/lib/utils/board-type-from-category-id"
import type { ListingImageForCard } from "@/lib/listing-image-display"

export type MobileListingSellerRow = {
  seller_slug?: string | null
  display_name?: string | null
  avatar_url?: string | null
  location?: string | null
  created_at?: string | null
  shop_verified?: boolean | null
  is_shop?: boolean | null
  shop_name?: string | null
  shop_logo_url?: string | null
}

export type MobileListingRow = {
  id: string
  user_id?: string | null
  slug: string | null
  created_at?: string | null
  views?: number | string | null
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
  listing_videos?: MobileListingVideoRow[] | null
  brand_id?: string | null
  profiles: MobileListingSellerRow | MobileListingSellerRow[] | null
}

export type MobileListingVideoRow = {
  id?: string | null
  url?: string | null
  thumbnail_url?: string | null
  content_type?: string | null
  duration_seconds?: number | string | null
  sort_order?: number | null
}

export const MOBILE_LISTING_SELECT = `
  id,
  user_id,
  slug,
  created_at,
  views,
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
  ${LISTING_SELLER_PROFILES_EMBED} (
    seller_slug,
    display_name,
    avatar_url,
    location,
    created_at,
    shop_verified,
    is_shop,
    shop_name,
    shop_logo_url
  )
`

/** Detail only. Feeds stay on `MOBILE_LISTING_SELECT` so cards do not pull video rows. */
export const MOBILE_LISTING_DETAIL_SELECT = `
  ${MOBILE_LISTING_SELECT},
  brand_id,
  listing_videos (id, url, thumbnail_url, content_type, duration_seconds, sort_order)
`

export type MobileListingListQuery = {
  limit: number
  offset: number
  q?: string
  section?: string
  /** Canonical surfboard shape. Matches `board_type` aliases and `category_id`. */
  boardType?: string
  sellerId?: string
  /** Browse is active-only. A profile shows current inventory, including pending sales, or sold history. */
  availability?: "active" | "current" | "sold"
}

function escapeIlikeToken(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/"/g, "")
}

export async function listMobileListingRows(
  query: MobileListingListQuery,
): Promise<{ ok: true; rows: MobileListingRow[]; hasMore: boolean } | { ok: false; message: string }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const availability = query.availability ?? "active"
  let request = supabase.from("listings").select(MOBILE_LISTING_SELECT)

  if (availability === "sold") {
    request = request.eq("status", "sold")
  } else if (availability === "current") {
    request = request
      .in("status", ["active", "pending_sale"])
      .eq("hidden_from_site", false)
      .is("archived_at", null)
  } else {
    request = request.eq("status", "active").eq("hidden_from_site", false).is("archived_at", null)
  }

  if (query.sellerId) {
    request = request.eq("user_id", query.sellerId).in("section", PEER_LISTING_SECTIONS_FILTER)
  }
  if (query.section) request = request.eq("section", query.section)
  if (query.boardType) {
    const dbTypes = listingBoardTypeDbValuesForFilter(query.boardType)
    const categoryId = categoryIdForBrowseBoardType(query.boardType)
    const parts: string[] = []
    if (dbTypes.length === 1) parts.push(`board_type.eq.${dbTypes[0]}`)
    else if (dbTypes.length > 1) parts.push(`board_type.in.(${dbTypes.join(",")})`)
    if (categoryId) parts.push(`category_id.eq.${categoryId}`)
    if (parts.length === 1 && dbTypes.length === 1) {
      request = request.eq("board_type", dbTypes[0]!)
    } else if (parts.length > 0) {
      request = request.or(parts.join(",")) as typeof request
    }
  }

  const q = query.q?.trim()
  if (q) {
    const pattern = `"%${escapeIlikeToken(q)}%"`
    request = request.or(`title.ilike.${pattern},brand.ilike.${pattern},model.ilike.${pattern}`)
  }

  const { data, error } = await request
    .not("title", "ilike", "admin seed%")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(query.offset, query.offset + query.limit)

  if (error) {
    return { ok: false, message: error.message }
  }

  const rows = (data ?? []) as unknown as MobileListingRow[]
  const hasMore = rows.length > query.limit
  return { ok: true, rows: hasMore ? rows.slice(0, query.limit) : rows, hasMore }
}

/** Public listing cards in the caller's order. Missing ids are dropped. */
export async function listMobileListingRowsByIds(
  ids: readonly string[],
): Promise<{ ok: true; rows: MobileListingRow[] } | { ok: false; message: string }> {
  const ordered = [...new Set(ids.map((id) => id.trim()).filter(Boolean))]
  if (ordered.length === 0) return { ok: true, rows: [] }

  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const { data, error } = await supabase.from("listings").select(MOBILE_LISTING_SELECT).in("id", ordered)
  if (error) return { ok: false, message: error.message }

  const byId = new Map<string, MobileListingRow>()
  for (const row of (data ?? []) as unknown as MobileListingRow[]) {
    byId.set(row.id, row)
  }
  const rows = ordered.flatMap((id) => {
    const row = byId.get(id)
    return row ? [row] : []
  })
  return { ok: true, rows }
}
