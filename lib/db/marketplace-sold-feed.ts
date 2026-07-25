import type { SupabaseClient } from "@supabase/supabase-js"
import { MARKETPLACE_SOLD_FEED_SECTIONS } from "@/lib/db/home-recently-sold-strip"

export const MARKETPLACE_SOLD_FEED_PAGE_SIZE = 40

export interface MarketplaceSoldFeedCursor {
  soldAt: string
  listingId: string
}

interface SoldFeedOrderRow {
  listing_id: string
  sale_confirmed_at: string
}

export interface MarketplaceSoldFeedOrderPage {
  orderedListingIds: string[]
  confirmedAtIsoByListingId: Map<string, string>
  hasMore: boolean
  nextCursor: MarketplaceSoldFeedCursor | null
}

export async function fetchMarketplaceSoldFeedOrderPage(
  supabase: SupabaseClient,
  options: {
    cursor: MarketplaceSoldFeedCursor | null
    brand: { id: string; name: string } | null
    pageSize?: number
  },
): Promise<MarketplaceSoldFeedOrderPage> {
  const pageSize = options.pageSize ?? MARKETPLACE_SOLD_FEED_PAGE_SIZE
  const sections = options.brand
    ? ["new", ...MARKETPLACE_SOLD_FEED_SECTIONS]
    : [...MARKETPLACE_SOLD_FEED_SECTIONS]
  const { data, error } = await supabase.rpc("marketplace_sold_listing_page", {
    p_limit: pageSize + 1,
    p_sections: sections,
    p_before_sale_at: options.cursor?.soldAt ?? null,
    p_before_listing_id: options.cursor?.listingId ?? null,
    p_brand_id: options.brand?.id ?? null,
    p_brand_name: options.brand?.name ?? null,
  })

  if (error) {
    console.error("[fetchMarketplaceSoldFeedOrderPage]", error.message)
    throw new Error("Unable to load sold listings")
  }

  const rows = ((data ?? []) as SoldFeedOrderRow[]).slice(0, pageSize)
  const confirmedAtIsoByListingId = new Map(
    rows.map((row) => [row.listing_id, row.sale_confirmed_at]),
  )
  const lastRow = rows.at(-1)

  return {
    orderedListingIds: rows.map((row) => row.listing_id),
    confirmedAtIsoByListingId,
    hasMore: (data?.length ?? 0) > pageSize,
    nextCursor: lastRow
      ? {
          soldAt: lastRow.sale_confirmed_at,
          listingId: lastRow.listing_id,
        }
      : null,
  }
}
