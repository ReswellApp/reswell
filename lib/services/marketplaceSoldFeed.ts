import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import type { SoldFeedListing } from "@/app/sold/sold-page-client"
import { fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering } from "@/lib/db/home-recently-sold-strip"
import {
  fetchRecentlyShippedSurfboardsConfirmedCheckoutOrdering,
  fetchSoldSurfboardListingIdsWithShippingFulfillment,
} from "@/lib/db/soldSurfboardShippingFulfillment"
import { listRecentlySoldListingsForBrand } from "@/lib/db/brand-listings"
import { getBrandBySlug } from "@/lib/brands/server"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { formatGmv } from "@/lib/format-gmv"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"

export const MARKETPLACE_SOLD_FEED_LIMIT = 40

const SOLD_LISTING_SELECT = `
  id,
  slug,
  user_id,
  title,
  price,
  condition,
  section,
  city,
  state,
  updated_at,
  board_type,
  dimensions,
  listing_images (url, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
  categories (name, slug)
`

export type MarketplaceSoldFeedPayload = {
  soldListings: SoldFeedListing[]
  soldStats: { count: number; gmvFormatted: string }
  brandFilterName: string | null
  brandUnknown: boolean
}

function mapSoldRow(
  row: Record<string, unknown>,
  saleConfirmedAtIso: string | null,
): SoldFeedListing {
  const dimStr = row.dimensions != null ? String(row.dimensions) : ""
  const boardLength = boardLengthLabelFromDimensionsColumn(dimStr) ?? null
  const soldAtRaw = saleConfirmedAtIso ?? row.sold_at ?? row.updated_at
  const soldAt = soldAtRaw ? String(soldAtRaw) : new Date().toISOString()
  const listPrice = publicListingListPriceUsd(row.price as string | number | null | undefined)

  return {
    id: String(row.id),
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: listPrice,
    soldPrice: listPrice,
    condition: String(row.condition ?? ""),
    section: String(row.section ?? "surfboards"),
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    board_type: row.board_type != null ? String(row.board_type) : null,
    board_length: boardLength,
    sold_at: soldAt,
    listing_images: row.listing_images as SoldFeedListing["listing_images"],
    profiles: row.profiles as SoldFeedListing["profiles"],
    categories: row.categories as SoldFeedListing["categories"],
  }
}

function mapRecentListingToSoldFeed(listing: RecentListing): SoldFeedListing {
  const listPrice = publicListingListPriceUsd(listing.price)
  const soldAt = listing.updated_at?.trim() || new Date().toISOString()
  return {
    id: listing.id,
    slug: listing.slug,
    user_id: listing.user_id,
    title: listing.title,
    price: listPrice,
    soldPrice: listPrice,
    condition: listing.condition ?? "",
    section: listing.section,
    city: listing.city ?? null,
    state: listing.state ?? null,
    board_type: listing.board_type ?? null,
    board_length: listing.board_length ?? null,
    sold_at: soldAt,
    listing_images: listing.listing_images,
    profiles: listing.profiles,
    categories: listing.categories,
  }
}

/** Public sold / shipped marketplace feed (no session). */
export async function loadMarketplaceSoldFeed(
  supabase: SupabaseClient,
  brandSlug: string | null,
  options?: { shippedOnly?: boolean },
): Promise<MarketplaceSoldFeedPayload> {
  const shippedOnly = options?.shippedOnly === true

  if (brandSlug) {
    const brand = await getBrandBySlug(supabase, brandSlug)
    if (!brand) {
      const stats = await getSoldFeedStats()
      return {
        soldListings: [],
        soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
        brandFilterName: null,
        brandUnknown: true,
      }
    }

    const soldRows = await listRecentlySoldListingsForBrand(
      supabase,
      { id: brand.id, name: brand.name },
      { limit: shippedOnly ? 120 : MARKETPLACE_SOLD_FEED_LIMIT },
    )
    let filteredRows = soldRows
    if (shippedOnly) {
      const surfboardIds = soldRows
        .filter((row) => row.section === "surfboards")
        .map((row) => row.id)
      const shippedIds = await fetchSoldSurfboardListingIdsWithShippingFulfillment(surfboardIds)
      filteredRows = soldRows
        .filter((row) => row.section === "surfboards" && shippedIds.has(row.id))
        .slice(0, MARKETPLACE_SOLD_FEED_LIMIT)
    }
    const stats = await getSoldFeedStats()
    return {
      soldListings: filteredRows.map(mapRecentListingToSoldFeed),
      soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
      brandFilterName: brand.name,
      brandUnknown: false,
    }
  }

  const { orderedListingIds, confirmedAtIsoByListingId } = shippedOnly
    ? await fetchRecentlyShippedSurfboardsConfirmedCheckoutOrdering(
        supabase,
        MARKETPLACE_SOLD_FEED_LIMIT,
      )
    : await fetchRecentlySoldSurfboardsConfirmedCheckoutOrdering(supabase, MARKETPLACE_SOLD_FEED_LIMIT)

  const [soldRes, stats] = await Promise.all([
    orderedListingIds.length === 0
      ? Promise.resolve({
          data: [] as Record<string, unknown>[] | null,
          error: null as { message: string } | null,
        })
      : supabase
          .from("listings")
          .select(SOLD_LISTING_SELECT)
          .in("id", orderedListingIds)
          .eq("status", "sold"),
    getSoldFeedStats(),
  ])

  if (soldRes.error) {
    console.error("[marketplaceSoldFeed] listings fetch:", soldRes.error.message)
  }

  const soldRows = (soldRes.data ?? []) as Record<string, unknown>[]
  const mapById = new Map(soldRows.map((r) => [String(r.id), r]))
  const soldListings: SoldFeedListing[] = orderedListingIds
    .map((id) => {
      const row = mapById.get(id)
      if (!row) return null
      const at = confirmedAtIsoByListingId.get(id) ?? null
      return mapSoldRow(row, at)
    })
    .filter((x): x is SoldFeedListing => x != null)

  return {
    soldListings,
    soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
    brandFilterName: null,
    brandUnknown: false,
  }
}
