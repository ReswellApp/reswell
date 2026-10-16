import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import {
  listingCoverImageForCard,
  listingImagesFromPrimaryFields,
} from "@/lib/listing-image-display"
import { SALE_FEED_PAGE_SIZE } from "@/lib/sale-feed"

/**
 * Public tile projection for `/sale`.
 * `compare_at_price` is the markdown: sellers opt in on a price drop, and
 * scheduled auto price drops write the same column. A trigger clears it when
 * it is not strictly above `price`, so a non-null value is an on-sale listing.
 */
const SALE_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  compare_at_price,
  is_good_deal,
  condition,
  section,
  local_pickup,
  shipping_available,
  board_type,
  primary_image_url,
  primary_thumbnail_url
`

export type SaleListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string | null
  price: number | string
  compare_at_price: number | string | null
  is_good_deal: boolean | null
  condition: string | null
  section: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  board_type: string | null
  primary_image_url: string | null
  primary_thumbnail_url: string | null
}

export type SaleListingsPageResult = {
  listings: RecentListing[]
  totalCount: number
}

export function mapSaleListingRow(row: SaleListingRow): RecentListing {
  const price = typeof row.price === "number" ? row.price : Number(row.price)
  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: Number.isFinite(price) ? price : 0,
    compare_at_price: row.compare_at_price,
    is_good_deal: row.is_good_deal === true,
    condition: row.condition != null ? String(row.condition) : null,
    section: String(row.section ?? ""),
    status: "active",
    local_pickup: row.local_pickup === true,
    shipping_available: row.shipping_available === true,
    board_type: row.board_type != null ? String(row.board_type) : null,
    listing_images: listingCoverImageForCard(
      listingImagesFromPrimaryFields(row.primary_image_url, row.primary_thumbnail_url),
    ),
  }
}

/**
 * One page of every active, site-visible listing with a public markdown.
 * Newest price changes first (`updated_at`), across every section.
 */
export async function fetchSaleListingsPage(
  supabase: SupabaseClient,
  options: { page: number; pageSize?: number },
): Promise<SaleListingsPageResult> {
  const pageSize = options.pageSize ?? SALE_FEED_PAGE_SIZE
  const page = Math.max(1, Math.floor(options.page) || 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  const { data, error, count } = await supabase
    .from("listings")
    .select(SALE_LISTING_SELECT, { count: "exact" })
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .not("compare_at_price", "is", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, to)

  if (error) {
    console.error("[fetchSaleListingsPage]", error.message)
    throw new Error("Sale feed query failed")
  }

  const listings = ((data ?? []) as SaleListingRow[]).map(mapSaleListingRow)
  return { listings, totalCount: count ?? listings.length }
}
