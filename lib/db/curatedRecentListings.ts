import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { listingImagesFromPrimaryFields } from "@/lib/listing-image-display"

const LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  condition,
  section,
  city,
  state,
  shipping_available,
  board_type,
  dimensions,
  created_at,
  primary_image_url,
  primary_thumbnail_url,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name, slug)
`

type ListingRow = Record<string, unknown> & {
  id: string
  created_at?: string
  profiles?: { sales_count?: number | null } | null
}

function rowToRecentListing(row: ListingRow): RecentListing {
  const boardLength = boardLengthLabelFromDimensionsColumn(
    row.dimensions != null ? String(row.dimensions) : "",
  )
  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: Number(row.price),
    condition: row.condition != null ? String(row.condition) : null,
    section: String(row.section ?? "surfboards"),
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    shipping_available: Boolean(row.shipping_available),
    board_type: row.board_type != null ? String(row.board_type) : null,
    board_length: boardLength,
    listing_images: listingImagesFromPrimaryFields(
      row.primary_image_url as string | null | undefined,
      row.primary_thumbnail_url as string | null | undefined,
    ),
    profiles: row.profiles as RecentListing["profiles"],
    categories: row.categories as RecentListing["categories"],
  }
}

/** Page size for the marketplace feed “New listings” tab (`/sold?tab=new`). */
export const NEW_LISTINGS_FEED_PAGE_SIZE = 48

export type NewestActiveListingsPageResult = {
  listings: RecentListing[]
  totalCount: number
}

function newestActiveListingsQuery(
  supabase: SupabaseClient,
  categoryId: string | null,
) {
  let q = supabase
    .from("listings")
    .select(LISTING_SELECT, { count: "exact" })
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else {
    q = q.eq("section", "surfboards")
  }

  return q.order("created_at", { ascending: false })
}

/**
 * One page of every active surfboard visible on the site, newest listed first.
 */
export async function fetchNewestActiveListingsPage(
  supabase: SupabaseClient,
  options: {
    categoryId?: string | null
    page: number
    pageSize?: number
  },
): Promise<NewestActiveListingsPageResult> {
  const pageSize = options.pageSize ?? NEW_LISTINGS_FEED_PAGE_SIZE
  const page = Math.max(1, Math.floor(options.page) || 1)
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const categoryId = options.categoryId ?? null

  const { data, error, count } = await newestActiveListingsQuery(supabase, categoryId).range(
    from,
    to,
  )

  if (error) {
    console.error("[fetchNewestActiveListingsPage]", error.message)
    return { listings: [], totalCount: 0 }
  }

  const listings = ((data ?? []) as ListingRow[]).map(rowToRecentListing)
  return { listings, totalCount: count ?? listings.length }
}

/** First N active surfboards (newest first) — used by curated search fallback. */
export async function fetchNewestActiveListings(
  supabase: SupabaseClient,
  categoryId: string | null,
  limit: number,
): Promise<RecentListing[]> {
  const { listings } = await fetchNewestActiveListingsPage(supabase, {
    categoryId,
    page: 1,
    pageSize: limit,
  })
  return listings
}

/**
 * Curated recents: active surfboards ranked by seller activity, then recency.
 * Used by `/search/recent` (not the marketplace feed new-listings tab).
 */
export async function fetchCuratedRecentListings(
  supabase: SupabaseClient,
  categoryId: string | null,
  limit: number,
): Promise<RecentListing[]> {
  const pool = Math.min(120, Math.max(limit * 4, 48))
  let q = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)

  if (categoryId) {
    q = q.eq("category_id", categoryId)
  } else {
    q = q.eq("section", "surfboards")
  }

  const { data: rows, error } = await q.order("created_at", { ascending: false }).limit(pool)

  if (error || !rows?.length) {
    return fetchNewestActiveListings(supabase, categoryId, limit)
  }

  const sorted = [...(rows as ListingRow[])].sort((a, b) => {
    const sa = a.profiles?.sales_count ?? 0
    const sb = b.profiles?.sales_count ?? 0
    if (sb !== sa) return sb - sa
    const tb = b.created_at ? new Date(b.created_at).getTime() : 0
    const ta = a.created_at ? new Date(a.created_at).getTime() : 0
    return tb - ta
  })

  return sorted.slice(0, limit).map(rowToRecentListing)
}
