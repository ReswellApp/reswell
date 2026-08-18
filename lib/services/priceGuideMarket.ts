import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listingTitleThumbnailCandidates,
  type ListingImageForCard,
} from "@/lib/listing-image-display"
import { listingDetailHref } from "@/lib/listing-href"
import { formatCondition, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import {
  type PriceGuideCategorySlug,
  priceGuideBrandHref,
  priceGuideCategoryHref,
  priceGuideCategoryLabel,
  priceGuideModelHref,
  priceGuideModelSlug,
  PRICE_GUIDE_CATEGORY_SLUGS,
} from "@/lib/price-guide/categories"
import {
  confidenceFromSample,
  moneyUsd,
  statsFromValues,
  typicalRangeFromStats,
} from "@/lib/price-guide/stats"
import {
  selectPriceGuideBrandsByIds,
  selectPriceGuideListings,
  selectPriceGuideLiveListings,
  selectPriceGuideModelsByIds,
  selectPriceGuideModelsForBrand,
  selectPriceGuideOrdersForListingIds,
  selectPriceGuideSnapshotsForListingIds,
  type PriceGuideBrandLite,
  type PriceGuideListingRow,
  type PriceGuideModelLite,
  type PriceGuideOrderRow,
  type PriceGuideSnapshotRow,
} from "@/lib/db/price-guide-market"
import type {
  PriceGuideComp,
  PriceGuideConditionBand,
  PriceGuideConfidence,
  PriceGuideEntryRecord,
  PriceGuideLiveListing,
  PriceGuideMarketStats,
  PriceGuideTypicalRange,
} from "@/lib/types/price-guide"

const CONDITION_ORDER = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const

export type PriceGuideResolvedSale = {
  listingId: string
  price: number
  soldAt: string
  condition: string | null
  dimensions: string | null
  title: string | null
  slug: string | null
  source: PriceGuideComp["source"]
  sourceLabel: string
}

export type PriceGuideMarketBundle = {
  listings: PriceGuideListingRow[]
  sales: PriceGuideResolvedSale[]
  snapshotsByListingId: Map<string, PriceGuideSnapshotRow>
  brandsById: Map<string, PriceGuideBrandLite>
  modelsById: Map<string, PriceGuideModelLite>
}

function isGuideCategory(section: string): section is PriceGuideCategorySlug {
  return (PRICE_GUIDE_CATEGORY_SLUGS as readonly string[]).includes(section)
}

export async function loadPriceGuideMarketBundle(
  supabase: SupabaseClient,
  filters?: { section?: PriceGuideCategorySlug; brandId?: string },
): Promise<PriceGuideMarketBundle> {
  const listings = (await selectPriceGuideListings(supabase, filters)).filter((row) =>
    isGuideCategory(row.section),
  )
  const listingIds = listings.map((row) => row.id)
  const [orders, snapshots] = await Promise.all([
    selectPriceGuideOrdersForListingIds(supabase, listingIds),
    selectPriceGuideSnapshotsForListingIds(supabase, listingIds),
  ])

  const snapshotsByListingId = new Map<string, PriceGuideSnapshotRow>()
  for (const snap of snapshots) snapshotsByListingId.set(snap.listing_id, snap)

  const listingsById = new Map(listings.map((row) => [row.id, row]))
  const sales = resolveSales(listingsById, orders, snapshotsByListingId)

  const brandIds = new Set<string>()
  const modelIds = new Set<string>()
  for (const row of listings) {
    if (row.brand_id) brandIds.add(row.brand_id)
    if (row.brand_model_id) modelIds.add(row.brand_model_id)
    const snap = snapshotsByListingId.get(row.id)
    if (snap?.brand_id) brandIds.add(snap.brand_id)
  }

  const [brands, models] = await Promise.all([
    selectPriceGuideBrandsByIds(supabase, [...brandIds]),
    selectPriceGuideModelsByIds(supabase, [...modelIds]),
  ])

  return {
    listings,
    sales,
    snapshotsByListingId,
    brandsById: new Map(brands.map((row) => [row.id, row])),
    modelsById: new Map(models.map((row) => [row.id, row])),
  }
}

function resolveSales(
  listingsById: Map<string, PriceGuideListingRow>,
  orders: PriceGuideOrderRow[],
  snapshotsByListingId: Map<string, PriceGuideSnapshotRow>,
): PriceGuideResolvedSale[] {
  const soldByListing = new Map<string, PriceGuideResolvedSale>()

  for (const order of orders) {
    const listing = listingsById.get(order.listing_id)
    const price = moneyUsd(order.amount)
    if (!listing || price == null) continue
    soldByListing.set(listing.id, {
      listingId: listing.id,
      price,
      soldAt: order.created_at.slice(0, 10),
      condition: listing.condition,
      dimensions: listing.dimensions,
      title: listing.title,
      slug: listing.slug,
      source: "reswell",
      sourceLabel: "Sold on Reswell",
    })
  }

  for (const listing of listingsById.values()) {
    if (soldByListing.has(listing.id)) continue
    const snap = snapshotsByListingId.get(listing.id)
    const snapPrice = moneyUsd(snap?.sold_price)
    if (snapPrice != null) {
      soldByListing.set(listing.id, {
        listingId: listing.id,
        price: snapPrice,
        soldAt: (listing.sold_off_platform_at ?? listing.updated_at ?? "").slice(0, 10),
        condition: listing.condition ?? snap?.condition ?? null,
        dimensions: listing.dimensions,
        title: listing.title,
        slug: listing.slug,
        source: "snapshot",
        sourceLabel: "Recorded sale",
      })
      continue
    }
    if (listing.status !== "sold") continue
    const ask = moneyUsd(listing.price)
    if (ask == null) continue
    soldByListing.set(listing.id, {
      listingId: listing.id,
      price: ask,
      soldAt: (listing.sold_off_platform_at ?? listing.updated_at ?? "").slice(0, 10),
      condition: listing.condition,
      dimensions: listing.dimensions,
      title: listing.title,
      slug: listing.slug,
      source: "listed_as_sold",
      sourceLabel: listing.sold_off_platform ? "Marked sold" : "Listed as sold",
    })
  }

  return [...soldByListing.values()].sort((a, b) => b.soldAt.localeCompare(a.soldAt))
}

export function askingPrices(listings: PriceGuideListingRow[]): number[] {
  const out: number[] = []
  for (const row of listings) {
    if (row.status !== "active" && row.status !== "pending_sale") continue
    const price = moneyUsd(row.price)
    if (price != null) out.push(price)
  }
  return out
}

export function salePrices(sales: PriceGuideResolvedSale[]): number[] {
  return sales.map((sale) => sale.price)
}

export function toMarketStats(
  listings: PriceGuideListingRow[],
  sales: PriceGuideResolvedSale[],
): { asking: PriceGuideMarketStats; sold: PriceGuideMarketStats } {
  return {
    asking: statsFromValues(askingPrices(listings)),
    sold: statsFromValues(salePrices(sales)),
  }
}

export function resolveTypicalRange(
  asking: PriceGuideMarketStats,
  sold: PriceGuideMarketStats,
  entry: PriceGuideEntryRecord | null,
): PriceGuideTypicalRange {
  const market = typicalRangeFromStats(sold, asking)
  if (!entry || entry.pricing_source === "market") {
    return {
      low_usd: market.low,
      mid_usd: market.mid,
      high_usd: market.high,
      new_retail_usd: entry?.new_retail_usd ?? null,
      source: "market",
    }
  }
  if (entry.pricing_source === "editorial") {
    return {
      low_usd: entry.typical_low_usd,
      mid_usd: entry.typical_mid_usd,
      high_usd: entry.typical_high_usd,
      new_retail_usd: entry.new_retail_usd,
      source: "editorial",
    }
  }
  return {
    low_usd: entry.typical_low_usd ?? market.low,
    mid_usd: entry.typical_mid_usd ?? market.mid,
    high_usd: entry.typical_high_usd ?? market.high,
    new_retail_usd: entry.new_retail_usd,
    source: "mixed",
  }
}

export function resolveConfidence(
  soldCount: number,
  askingCount: number,
  entry: PriceGuideEntryRecord | null,
): PriceGuideConfidence {
  if (entry?.confidence) return entry.confidence
  const computed = confidenceFromSample(soldCount, askingCount)
  if (entry?.pricing_source === "editorial" && computed === "thin") return "emerging"
  return computed
}

export function conditionBandsFromSales(sales: PriceGuideResolvedSale[]): PriceGuideConditionBand[] {
  const byCondition = new Map<string, number[]>()
  for (const sale of sales) {
    const key = sale.condition?.trim()
    if (!key) continue
    const list = byCondition.get(key) ?? []
    list.push(sale.price)
    byCondition.set(key, list)
  }

  const keys: string[] = CONDITION_ORDER.filter((key) => byCondition.has(key))
  for (const key of byCondition.keys()) {
    if (!keys.includes(key)) keys.push(key)
  }

  return keys.map((condition) => {
    const stats = statsFromValues(byCondition.get(condition) ?? [])
    return {
      condition,
      condition_label: LISTING_CONDITION_LABELS[condition] ?? formatCondition(condition),
      low_usd: stats.p25_usd ?? stats.min_usd,
      mid_usd: stats.median_usd,
      high_usd: stats.p75_usd ?? stats.max_usd,
      sample_count: stats.count,
    }
  })
}

export function mergeConditionBands(
  market: PriceGuideConditionBand[],
  editorial: PriceGuideConditionBand[] | undefined,
): PriceGuideConditionBand[] {
  if (!editorial || editorial.length === 0) return market
  const byCondition = new Map(market.map((band) => [band.condition, band]))
  for (const band of editorial) {
    const existing = byCondition.get(band.condition)
    byCondition.set(band.condition, {
      condition: band.condition,
      condition_label: band.condition_label || existing?.condition_label || formatCondition(band.condition),
      low_usd: band.low_usd ?? existing?.low_usd ?? null,
      mid_usd: band.mid_usd ?? existing?.mid_usd ?? null,
      high_usd: band.high_usd ?? existing?.high_usd ?? null,
      sample_count: existing?.sample_count ?? band.sample_count,
    })
  }
  return [...byCondition.values()]
}

export function compsFromSales(sales: PriceGuideResolvedSale[], limit = 12): PriceGuideComp[] {
  return sales.slice(0, limit).map((sale) => ({
    id: `sale:${sale.listingId}`,
    sold_price_usd: sale.price,
    sold_at: sale.soldAt || "—",
    condition: sale.condition,
    condition_label: sale.condition ? formatCondition(sale.condition) : null,
    dimensions: sale.dimensions?.trim() || null,
    title: sale.title?.trim() || null,
    source: sale.source,
    source_label: sale.sourceLabel,
    listing_url: listingDetailHref({ id: sale.listingId, slug: sale.slug }),
    include_in_public: true,
  }))
}

export function mergeComps(market: PriceGuideComp[], manual: PriceGuideComp[], limit = 16): PriceGuideComp[] {
  const merged = [...manual, ...market]
  merged.sort((a, b) => b.sold_at.localeCompare(a.sold_at))
  return merged.slice(0, limit)
}

export function listingMatchesModel(
  listing: PriceGuideListingRow,
  snap: PriceGuideSnapshotRow | undefined,
  model: { id: string | null; slug: string; name: string },
): boolean {
  if (model.id && listing.brand_model_id === model.id) return true
  if (snap?.catalog_model_slug && snap.catalog_model_slug === model.slug) return true
  const listingSlug = listing.model ? priceGuideModelSlug(listing.model) : ""
  if (listingSlug && listingSlug === model.slug) return true
  const snapNameSlug = snap?.model_name ? priceGuideModelSlug(snap.model_name) : ""
  return Boolean(snapNameSlug && snapNameSlug === model.slug)
}

export function resolveListingBrand(
  listing: PriceGuideListingRow,
  snap: PriceGuideSnapshotRow | undefined,
  brandsById: Map<string, PriceGuideBrandLite>,
): PriceGuideBrandLite | null {
  if (listing.brand_id) {
    const brand = brandsById.get(listing.brand_id)
    if (brand) return brand
  }
  if (snap?.brand_id) {
    const brand = brandsById.get(snap.brand_id)
    if (brand) return brand
  }
  return null
}

export function resolveListingModelName(
  listing: PriceGuideListingRow,
  snap: PriceGuideSnapshotRow | undefined,
  modelsById: Map<string, PriceGuideModelLite>,
): { id: string | null; name: string; slug: string } | null {
  if (listing.brand_model_id) {
    const model = modelsById.get(listing.brand_model_id)
    if (model) {
      return { id: model.id, name: model.name, slug: priceGuideModelSlug(model.name) }
    }
  }
  const snapName = snap?.model_name?.trim()
  if (snapName) {
    return { id: null, name: snapName, slug: snap?.catalog_model_slug || priceGuideModelSlug(snapName) }
  }
  const text = listing.model?.trim()
  if (!text) return null
  return { id: listing.brand_model_id, name: text, slug: priceGuideModelSlug(text) }
}

export function mapLiveListings(
  rows: Awaited<ReturnType<typeof selectPriceGuideLiveListings>>,
): PriceGuideLiveListing[] {
  return rows.map((row) => {
    const price = moneyUsd(row.price) ?? 0
    return {
      id: row.id,
      title: row.title?.trim() || "Untitled listing",
      price_usd: price,
      condition_label: row.condition ? formatCondition(row.condition) : null,
      dimensions: row.dimensions?.trim() || null,
      city: row.city?.trim() || null,
      state: row.state?.trim() || null,
      image_url: listingTitleThumbnailCandidates(
        (row.listing_images ?? []) as ListingImageForCard[],
      )[0] ?? null,
      href: listingDetailHref({ id: row.id, slug: row.slug }),
    }
  })
}

export async function loadLiveListingsForScope(
  supabase: SupabaseClient,
  filters: {
    section: PriceGuideCategorySlug
    brandId: string
    listingIds?: string[]
  },
): Promise<PriceGuideLiveListing[]> {
  const rows = await selectPriceGuideLiveListings(supabase, filters, 8)
  return mapLiveListings(rows)
}

export { selectPriceGuideModelsForBrand, priceGuideCategoryHref, priceGuideBrandHref, priceGuideModelHref }

export function emptyTypical(): PriceGuideTypicalRange {
  return {
    low_usd: null,
    mid_usd: null,
    high_usd: null,
    new_retail_usd: null,
    source: "market",
  }
}

export function categoryLabel(slug: PriceGuideCategorySlug): string {
  return priceGuideCategoryLabel(slug)
}
