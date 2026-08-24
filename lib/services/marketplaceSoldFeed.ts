import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/components/recent-feed-client"
import type { SoldFeedListing } from "@/app/sold/sold-page-client"
import {
  fetchRecentlySoldListingsConfirmedCheckoutOrdering,
  MARKETPLACE_SOLD_FEED_SECTIONS,
} from "@/lib/db/home-recently-sold-strip"
import { fetchAdminTerminalSoldListingIds } from "@/lib/db/admin-terminal-sold-feed"
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
import { isListingVisibleInPublicSoldFeed } from "@/lib/listing-public-visibility"
import {
  fetchMarketplaceSoldFeedOrderPage,
  type MarketplaceSoldFeedCursor,
} from "@/lib/db/marketplace-sold-feed"

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
  listing_images (url, thumbnail_url, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
  categories (name, slug)
`

export type MarketplaceSoldFeedPayload = {
  soldListings: SoldFeedListing[]
  soldStats: { count: number; gmvFormatted: string }
  brandFilterName: string | null
  brandUnknown: boolean
  hasMore: boolean
  nextCursor: MarketplaceSoldFeedCursor | null
}

export type MarketplaceSoldFeedPagePayload = Pick<
  MarketplaceSoldFeedPayload,
  "soldListings" | "brandFilterName" | "brandUnknown" | "hasMore" | "nextCursor"
>

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

export async function loadMarketplaceSoldFeedPage(
  supabase: SupabaseClient,
  brandSlug: string | null,
  cursor: MarketplaceSoldFeedCursor | null,
): Promise<MarketplaceSoldFeedPagePayload> {
  const brand = brandSlug ? await getBrandBySlug(supabase, brandSlug) : null
  if (brandSlug && !brand) {
    return {
      soldListings: [],
      brandFilterName: null,
      brandUnknown: true,
      hasMore: false,
      nextCursor: null,
    }
  }

  const orderPage = await fetchMarketplaceSoldFeedOrderPage(supabase, {
    cursor,
    brand: brand ? { id: brand.id, name: brand.name } : null,
  })

  if (orderPage.orderedListingIds.length === 0) {
    return {
      soldListings: [],
      brandFilterName: brand?.name ?? null,
      brandUnknown: false,
      hasMore: false,
      nextCursor: null,
    }
  }

  const { data, error } = await supabase
    .from("listings")
    .select(`${SOLD_LISTING_SELECT}, hidden_from_site, archived_at`)
    .in("id", orderPage.orderedListingIds)
    .eq("status", "sold")

  if (error) {
    console.error("[marketplaceSoldFeedPage] listings fetch:", error.message)
    throw new Error("Unable to load sold listings")
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const rowsById = new Map(rows.map((row) => [String(row.id), row]))
  const adminTerminalSoldIds = await fetchAdminTerminalSoldListingIds(
    supabase,
    orderPage.orderedListingIds,
  )
  const soldListings = orderPage.orderedListingIds
    .map((id) => {
      const row = rowsById.get(id)
      if (!row) return null
      if (
        !isListingVisibleInPublicSoldFeed({
          title: String(row.title ?? ""),
          status: "sold",
          hidden_from_site: row.hidden_from_site as boolean | null | undefined,
          archived_at: row.archived_at as string | null | undefined,
          soldViaAdminTerminal: adminTerminalSoldIds.has(id),
        })
      ) {
        return null
      }
      return mapSoldRow(row, orderPage.confirmedAtIsoByListingId.get(id) ?? null)
    })
    .filter((listing): listing is SoldFeedListing => listing != null)

  return {
    soldListings,
    brandFilterName: brand?.name ?? null,
    brandUnknown: false,
    hasMore: orderPage.hasMore,
    nextCursor: orderPage.nextCursor,
  }
}

/** Public sold / shipped marketplace feed (no session). Tipped mark-as-sold listings are included via the sold-page RPC. */
export async function loadMarketplaceSoldFeed(
  supabase: SupabaseClient,
  brandSlug: string | null,
  options?: { shippedOnly?: boolean },
): Promise<MarketplaceSoldFeedPayload> {
  const shippedOnly = options?.shippedOnly === true

  if (!shippedOnly) {
    const [page, stats] = await Promise.all([
      loadMarketplaceSoldFeedPage(supabase, brandSlug, null),
      getSoldFeedStats([...MARKETPLACE_SOLD_FEED_SECTIONS]),
    ])
    return {
      ...page,
      soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
    }
  }

  if (brandSlug) {
    const brand = await getBrandBySlug(supabase, brandSlug)
    if (!brand) {
      const stats = await getSoldFeedStats([...MARKETPLACE_SOLD_FEED_SECTIONS])
      return {
        soldListings: [],
        soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
        brandFilterName: null,
        brandUnknown: true,
        hasMore: false,
        nextCursor: null,
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
    const stats = await getSoldFeedStats([...MARKETPLACE_SOLD_FEED_SECTIONS])
    return {
      soldListings: filteredRows.map(mapRecentListingToSoldFeed),
      soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
      brandFilterName: brand.name,
      brandUnknown: false,
      hasMore: false,
      nextCursor: null,
    }
  }

  const { orderedListingIds, confirmedAtIsoByListingId } = shippedOnly
    ? await fetchRecentlyShippedSurfboardsConfirmedCheckoutOrdering(
        supabase,
        MARKETPLACE_SOLD_FEED_LIMIT,
      )
    : await fetchRecentlySoldListingsConfirmedCheckoutOrdering(
        supabase,
        MARKETPLACE_SOLD_FEED_LIMIT,
        MARKETPLACE_SOLD_FEED_SECTIONS,
      )

  const [soldRes, stats] = await Promise.all([
    orderedListingIds.length === 0
      ? Promise.resolve({
          data: [] as Record<string, unknown>[] | null,
          error: null as { message: string } | null,
        })
      : supabase
          .from("listings")
          .select(`${SOLD_LISTING_SELECT}, hidden_from_site, archived_at`)
          .in("id", orderedListingIds)
          .eq("status", "sold"),
    getSoldFeedStats([...MARKETPLACE_SOLD_FEED_SECTIONS]),
  ])

  if (soldRes.error) {
    console.error("[marketplaceSoldFeed] listings fetch:", soldRes.error.message)
  }

  const soldRows = (soldRes.data ?? []) as Record<string, unknown>[]
  const mapById = new Map(soldRows.map((r) => [String(r.id), r]))
  const adminTerminalSoldIds = await fetchAdminTerminalSoldListingIds(supabase, orderedListingIds)
  const soldListings: SoldFeedListing[] = orderedListingIds
    .map((id) => {
      const row = mapById.get(id)
      if (!row) return null
      if (
        !isListingVisibleInPublicSoldFeed({
          title: String(row.title ?? ""),
          status: String(row.status ?? "sold"),
          hidden_from_site: row.hidden_from_site as boolean | null | undefined,
          archived_at: row.archived_at as string | null | undefined,
          soldViaAdminTerminal: adminTerminalSoldIds.has(id),
        })
      ) {
        return null
      }
      const at = confirmedAtIsoByListingId.get(id) ?? null
      return mapSoldRow(row, at)
    })
    .filter((x): x is SoldFeedListing => x != null)

  return {
    soldListings,
    soldStats: { count: stats.soldCount, gmvFormatted: formatGmv(stats.gmvTotal) },
    brandFilterName: null,
    brandUnknown: false,
    hasMore: false,
    nextCursor: null,
  }
}
