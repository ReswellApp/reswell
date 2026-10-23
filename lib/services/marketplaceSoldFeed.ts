import type { SupabaseClient } from "@supabase/supabase-js"
import type { SoldFeedListing } from "@/app/sold/sold-page-client"
import { MARKETPLACE_SOLD_FEED_SECTIONS } from "@/lib/db/home-recently-sold-strip"
import { fetchAdminTerminalSoldListingIds } from "@/lib/db/admin-terminal-sold-feed"
import { fetchShippedSurfboardSaleOrdering } from "@/lib/db/soldSurfboardShippingFulfillment"
import { filterListingIdsMatchingBrand } from "@/lib/db/brand-listings"
import { getBrandBySlug } from "@/lib/brands/server"
import { sliceMarketplaceFeedPage } from "@/lib/marketplace-feed-tab"
import { getSoldFeedStats } from "@/lib/feed-sold-stats"
import { boardLengthLabelFromDimensionsColumn } from "@/lib/listing-dimensions-storage"
import { publicListingListPriceUsd } from "@/lib/utils/public-listing-price"
import {
  isInStockBrandNewUnitSale,
  isListingVisibleInPublicSoldFeed,
} from "@/lib/listing-public-visibility"
import {
  soldFeedShowsSaleQuantity,
  soldFeedTilePrice,
} from "@/lib/sold-feed-sale-label"
import {
  listingCoverImageForCard,
  listingImagesFromPrimaryFields,
} from "@/lib/listing-image-display"
import {
  fetchMarketplaceSoldFeedOrderPage,
  type MarketplaceSoldFeedCursor,
  type MarketplaceSoldFeedSale,
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
  primary_image_url,
  primary_thumbnail_url,
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count),
  categories (name, slug)
`

export type MarketplaceSoldFeedPayload = {
  soldListings: SoldFeedListing[]
  /** Raw total. The page formats this on read so a label change is not stuck in the data cache. */
  soldStats: { count: number; gmvTotal: number }
  brandFilterName: string | null
  brandUnknown: boolean
  hasMore: boolean
  nextCursor: MarketplaceSoldFeedCursor | null
}

export type MarketplaceSoldFeedPagePayload = Pick<
  MarketplaceSoldFeedPayload,
  "soldListings" | "brandFilterName" | "brandUnknown" | "hasMore" | "nextCursor"
>

export type MarketplaceShippedFeedPayload = {
  soldListings: SoldFeedListing[]
  totalCount: number
  totalPages: number
  page: number
  brandFilterName: string | null
  brandUnknown: boolean
}

function mapSoldRow(
  row: Record<string, unknown>,
  sale: MarketplaceSoldFeedSale,
): SoldFeedListing {
  const dimStr = row.dimensions != null ? String(row.dimensions) : ""
  const boardLength = boardLengthLabelFromDimensionsColumn(dimStr) ?? null
  const soldAtRaw = sale.soldAt || row.sold_at || row.updated_at
  const soldAt = soldAtRaw ? String(soldAtRaw) : new Date().toISOString()
  const listPrice = publicListingListPriceUsd(row.price as string | number | null | undefined)
  const stockQuantity =
    typeof row.stock_quantity === "number" ? row.stock_quantity : Number(row.stock_quantity ?? 0)
  const listingStillInStock = isInStockBrandNewUnitSale({
    title: String(row.title ?? ""),
    status: String(row.status ?? "sold"),
    hidden_from_site: row.hidden_from_site as boolean | null | undefined,
    archived_at: row.archived_at as string | null | undefined,
    condition: row.condition != null ? String(row.condition) : null,
    stock_quantity: stockQuantity,
  })

  return {
    id: String(row.id),
    saleLineId: sale.saleLineId,
    slug: row.slug != null ? String(row.slug) : null,
    user_id: String(row.user_id),
    title: String(row.title ?? ""),
    price: listPrice,
    soldPrice: soldFeedTilePrice(listPrice, sale.quantity, sale.lineTotal),
    quantitySold: sale.quantity,
    showSaleQuantity: soldFeedShowsSaleQuantity({
      quantity: sale.quantity,
      listingStillInStock,
    }),
    condition: String(row.condition ?? ""),
    section: String(row.section ?? "surfboards"),
    city: row.city != null ? String(row.city) : null,
    state: row.state != null ? String(row.state) : null,
    board_type: row.board_type != null ? String(row.board_type) : null,
    board_length: boardLength,
    sold_at: soldAt,
    listing_images: listingCoverImageForCard(
      listingImagesFromPrimaryFields(
        row.primary_image_url as string | null | undefined,
        row.primary_thumbnail_url as string | null | undefined,
      ),
    ),
    profiles: row.profiles as SoldFeedListing["profiles"],
    categories: row.categories as SoldFeedListing["categories"],
  }
}

async function hydrateSoldFeedListings(
  supabase: SupabaseClient,
  sales: readonly MarketplaceSoldFeedSale[],
): Promise<SoldFeedListing[]> {
  if (sales.length === 0) return []

  const orderedListingIds = [...new Set(sales.map((sale) => sale.listingId))]
  const { data, error } = await supabase
    .from("listings")
    .select(`${SOLD_LISTING_SELECT}, hidden_from_site, archived_at, stock_quantity, status`)
    .in("id", orderedListingIds)
    .in("status", ["sold", "active"])

  if (error) {
    console.error("[marketplaceSoldFeed] listings fetch:", error.message)
    throw new Error("Unable to load sold listings")
  }

  const rows = (data ?? []) as Record<string, unknown>[]
  const rowsById = new Map(rows.map((row) => [String(row.id), row]))
  const adminTerminalSoldIds = await fetchAdminTerminalSoldListingIds(
    supabase,
    orderedListingIds,
  )

  return sales
    .map((sale) => {
      const row = rowsById.get(sale.listingId)
      if (!row) return null
      const visibility = {
        title: String(row.title ?? ""),
        status: String(row.status ?? "sold"),
        hidden_from_site: row.hidden_from_site as boolean | null | undefined,
        archived_at: row.archived_at as string | null | undefined,
        soldViaAdminTerminal: adminTerminalSoldIds.has(sale.listingId),
        condition: row.condition != null ? String(row.condition) : null,
        stock_quantity:
          typeof row.stock_quantity === "number" ? row.stock_quantity : Number(row.stock_quantity ?? 0),
      }
      if (!isListingVisibleInPublicSoldFeed(visibility) && !isInStockBrandNewUnitSale(visibility)) {
        return null
      }
      return mapSoldRow(row, sale)
    })
    .filter((listing): listing is SoldFeedListing => listing != null)
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

  const soldListings = await hydrateSoldFeedListings(supabase, orderPage.sales)

  return {
    soldListings,
    brandFilterName: brand?.name ?? null,
    brandUnknown: false,
    hasMore: orderPage.hasMore,
    nextCursor: orderPage.nextCursor,
  }
}

export async function loadMarketplaceShippedFeedPage(
  supabase: SupabaseClient,
  brandSlug: string | null,
  page: number,
): Promise<MarketplaceShippedFeedPayload> {
  const brand = brandSlug ? await getBrandBySlug(supabase, brandSlug) : null
  if (brandSlug && !brand) {
    return {
      soldListings: [],
      totalCount: 0,
      totalPages: 1,
      page: Math.max(1, Math.floor(page) || 1),
      brandFilterName: null,
      brandUnknown: true,
    }
  }

  const ordering = await fetchShippedSurfboardSaleOrdering(supabase)
  const orderedListingIds = brand
    ? await filterListingIdsMatchingBrand(supabase, ordering.orderedListingIds, {
        id: brand.id,
        name: brand.name,
      })
    : ordering.orderedListingIds

  const sliced = sliceMarketplaceFeedPage(
    orderedListingIds,
    page,
    MARKETPLACE_SOLD_FEED_LIMIT,
  )
  const soldListings = await hydrateSoldFeedListings(
    supabase,
    sliced.pageItems.map((listingId) => ({
      listingId,
      soldAt: ordering.confirmedAtIsoByListingId.get(listingId) ?? "",
      quantity: 1,
      saleLineId: listingId,
      lineTotal: null,
    })),
  )

  return {
    soldListings,
    totalCount: sliced.totalCount,
    totalPages: sliced.totalPages,
    page: sliced.page,
    brandFilterName: brand?.name ?? null,
    brandUnknown: false,
  }
}

/** Public sold / shipped marketplace feed (no session). Each checkout of a brand-new quantity listing is its own tile. The listing stays active while stock remains. */
export async function loadMarketplaceSoldFeed(
  supabase: SupabaseClient,
  brandSlug: string | null,
  options?: { shippedOnly?: boolean },
): Promise<MarketplaceSoldFeedPayload> {
  if (options?.shippedOnly === true) {
    const shipped = await loadMarketplaceShippedFeedPage(supabase, brandSlug, 1)
    return {
      soldListings: shipped.soldListings,
      soldStats: { count: shipped.totalCount, gmvTotal: 0 },
      brandFilterName: shipped.brandFilterName,
      brandUnknown: shipped.brandUnknown,
      hasMore: shipped.totalPages > 1,
      nextCursor: null,
    }
  }

  const [page, stats] = await Promise.all([
    loadMarketplaceSoldFeedPage(supabase, brandSlug, null),
    getSoldFeedStats([...MARKETPLACE_SOLD_FEED_SECTIONS]),
  ])
  return {
    ...page,
    soldStats: { count: stats.soldCount, gmvTotal: stats.gmvTotal },
  }
}
