import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import {
  finBoxesDisplayName,
  finPlugsDisplayName,
  materialDisplayName,
} from "@/lib/utils/brand-model-dimensions"
import {
  canonicalListingsBoardTypeKey,
  listingBoardTypeDbValuesForFilter,
} from "@/lib/board-type-canonical"
import {
  DASHBOARD_RANGE_OPTIONS,
  type DashboardBoardTypeRow,
  type DashboardChannelMix,
  type DashboardChannelRow,
  type DashboardConditionRow,
  type DashboardDimension,
  type DashboardDistributionBucket,
  type DashboardFilterOptions,
  type DashboardFilters,
  type DashboardGroupedRow,
  type DashboardInventoryAging,
  type DashboardKpis,
  type DashboardLocationRow,
  type DashboardPriceBucketRow,
  type DashboardPriceRealization,
  type DashboardSellerRow,
  type DashboardSeriesPoint,
  type DashboardSoldHistoryRow,
  type DashboardVariantCoverage,
  type DashboardViewingScope,
  type UsedBoardMarketDashboard,
} from "@/lib/services/usedBoardMarketDashboard.shared"
import type { BrandModelVariantMaterial, FinBoxesType, FinBoxType } from "@/lib/validations/brand-model-variants"
import { slugify } from "@/lib/slugify"

/**
 * Used surfboard market analytics — aggregates from `listings`, `orders`,
 * `brands`, and the `user_listing_board_model_data` snapshot table.
 *
 * Key concepts:
 *  - "Used surfboard": `listings.section = 'surfboards'`.
 *  - "Sold (in range)": `orders.status = 'confirmed'` joined to a surfboard
 *    listing, where `orders.created_at` is in [from, now]. Refunded orders
 *    are excluded from sold counts and price aggregations.
 *  - "Sale date": `orders.created_at`. There is no `listings.sold_at`.
 *  - "Days to sell": `orders.created_at − listings.created_at` (days).
 *  - "Sell-through (in range)": sold ÷ (sold + active) for that group.
 *
 * Catalog hierarchy (drives the regrouping cards):
 *   brand → model → variant → leaf
 *
 * The grouping dimension is the deepest catalog level not yet pinned by a
 * filter. Orthogonal dimensions (board_type, condition, state) always group
 * by themselves.
 *
 * Types and the range-options constant live in
 * `usedBoardMarketDashboard.shared.ts` so client components can import them
 * without dragging server-only modules through webpack.
 */

const ABSOLUTE_FETCH_CAP = 5000
const HISTORY_TABLE_LIMIT = 200
const ORTHOGONAL_LOCATION_LIMIT = 16

const CONDITION_ORDER = ["brand_new", "excellent", "very_good", "good", "fair", "poor"] as const
type ConditionKey = (typeof CONDITION_ORDER)[number]

const PRICE_BUCKETS: { label: string; min: number; max: number | null }[] = [
  { label: "<$250", min: 0, max: 250 },
  { label: "$250–$500", min: 250, max: 500 },
  { label: "$500–$750", min: 500, max: 750 },
  { label: "$750–$1k", min: 750, max: 1000 },
  { label: "$1k–$1.5k", min: 1000, max: 1500 },
  { label: "$1.5k–$2k", min: 1500, max: 2000 },
  { label: "$2k–$3k", min: 2000, max: 3000 },
  { label: "$3k+", min: 3000, max: null },
]

const SENTINEL_UNBRANDED = "__unbranded"
const SENTINEL_UNCATALOGUED_MODEL = "__uncatalogued_model"
const SENTINEL_UNCATALOGUED_VARIANT = "__uncatalogued_variant"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toNumber(value: unknown): number | null {
  if (value == null) return null
  if (typeof value === "number") return Number.isFinite(value) ? value : null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((s, v) => s + v, 0) / values.length
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function buildDailyKeys(fromIso: string | null, toIso: string): string[] {
  const to = new Date(toIso)
  const from = fromIso
    ? new Date(fromIso)
    : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000)

  const start = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()))
  const keys: string[] = []
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    keys.push(d.toISOString().slice(0, 10))
  }
  return keys
}

function pickFirstJoined<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null
  return Array.isArray(value) ? (value[0] ?? null) : value
}

function formatDimensions(row: { dimensions?: string | null }): string | null {
  const stored = row.dimensions?.trim()
  return stored || null
}

function boardTypeLabel(boardType: string | null | undefined): string {
  if (!boardType) return "Unspecified"
  const v = boardType.trim().toLowerCase()
  if (!v) return "Unspecified"
  const overrides: Record<string, string> = {
    shortboard: "Shortboard",
    longboard: "Longboard",
    hybrid: "Hybrid",
    funboard: "Hybrid",
    fish: "Fish",
    groveler: "Groveler",
    "step-up": "Step-up / Gun",
    "step-up-gun": "Step-up / Gun",
    gun: "Step-up / Gun",
    other: "Other",
  }
  return overrides[v] ?? v.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function conditionLabel(condition: string | null | undefined): string {
  if (!condition) return "Unspecified"
  const v = condition.trim()
  return LISTING_CONDITION_LABELS[v] ?? v.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function finBoxLabel(fin: string | null | undefined): string {
  const v = fin?.trim()
  if (!v) return "Fins —"
  return finPlugsDisplayName(v as FinBoxType)
}

function variantSyntheticKey(snap: SnapshotRow): string {
  return [
    snap.length_label ?? "",
    snap.width_label ?? "",
    snap.thickness_label ?? "",
    snap.volume_label ?? "",
    snap.condition ?? "",
  ]
    .map((s) => s.trim().toLowerCase())
    .join("|")
}

function variantSyntheticLabel(snap: SnapshotRow): string {
  const parts = [snap.length_label, snap.width_label, snap.thickness_label]
    .filter((s): s is string => Boolean(s?.trim()))
  const dim = parts.join(" × ")
  const vol = snap.volume_label?.trim() ? ` / ${snap.volume_label.trim()}` : ""
  const cond = snap.condition ? ` · ${conditionLabel(snap.condition)}` : ""
  return (dim + vol + cond).trim() || "Unknown variant"
}

function variantCanonicalLabel(v: VariantRow): string {
  return `${v.length_label} × ${v.width_label} × ${v.thickness_label} / ${v.volume_label} · ${finBoxLabel(
    v.fin_box_type,
  )} · ${finBoxesDisplayName(v.fin_boxes)} · ${materialDisplayName(v.material)} · ${conditionLabel(v.condition)}`
}

// ---------------------------------------------------------------------------
// Internal row types
// ---------------------------------------------------------------------------

type ListingRow = {
  id: string
  user_id: string | null
  slug: string | null
  title: string | null
  section: string | null
  status: string | null
  hidden_from_site: boolean | null
  brand: string | null
  brand_id: string | null
  board_type: string | null
  condition: string | null
  city: string | null
  state: string | null
  price: number | string | null
  views: number | null
  created_at: string
  updated_at: string | null
  dimensions: string | null
}

type OrderJoinedRow = {
  id: string
  order_num: string | null
  amount: number | string | null
  platform_fee: number | string | null
  seller_earnings: number | string | null
  status: string | null
  delivery_status: string | null
  payment_method: string | null
  fulfillment_method: string | null
  refunded_at: string | null
  created_at: string
  buyer_id: string | null
  seller_id: string | null
  listing_id: string | null
  listings: ListingRow | null
}

type SnapshotRow = {
  listing_id: string
  brand_id: string | null
  catalog_brand_slug: string | null
  catalog_model_slug: string | null
  model_name: string | null
  length_label: string | null
  width_label: string | null
  thickness_label: string | null
  volume_label: string | null
  condition: string | null
  sold_price: number | string | null
  converted_brand_model_variant_id: string | null
}

type VariantRow = {
  id: string
  brand_id: string
  brand_model_id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: string
  fin_boxes: FinBoxesType
  material: BrandModelVariantMaterial
  condition: string
  price: number | string | null
}

type ProfileLite = { id: string; display_name: string | null }
type BrandLite = { id: string; name: string; slug: string | null; logo_url: string | null }

// ---------------------------------------------------------------------------
// Service entry point
// ---------------------------------------------------------------------------

const LISTINGS_SELECT =
  "id, user_id, slug, title, section, status, hidden_from_site, brand, brand_id, board_type, condition, city, state, price, views, created_at, updated_at, dimensions"

const ORDERS_SELECT_WITH_LISTINGS = `
  id, order_num, amount, platform_fee, seller_earnings, status, delivery_status,
  payment_method, fulfillment_method, refunded_at, created_at, buyer_id, seller_id, listing_id,
  listings:listing_id ( ${LISTINGS_SELECT} )
`

const SNAPSHOT_SELECT =
  "listing_id, brand_id, catalog_brand_slug, catalog_model_slug, model_name, length_label, width_label, thickness_label, volume_label, condition, sold_price, converted_brand_model_variant_id"

const VARIANT_SELECT =
  "id, brand_id, brand_model_id, length_label, width_label, thickness_label, volume_label, fin_box_type, fin_boxes, material, condition, price"

export async function getUsedBoardMarketDashboardService(
  filters: DashboardFilters,
): Promise<UsedBoardMarketDashboard> {
  let db: SupabaseClient
  const warnings: string[] = []

  try {
    db = createServiceRoleClient()
  } catch {
    warnings.push(
      "Service role key not configured — falling back to anon client. Some inventory/order rows may be hidden by RLS.",
    )
    const { createAnonSupabaseClient } = await import("@/lib/supabase/server")
    db = createAnonSupabaseClient()
  }

  const rangeOption =
    DASHBOARD_RANGE_OPTIONS.find((o) => o.value === filters.range) ?? DASHBOARD_RANGE_OPTIONS[1]

  const now = new Date()
  const toIso = now.toISOString()
  const fromIso = rangeOption.days
    ? new Date(now.getTime() - rangeOption.days * 24 * 60 * 60 * 1000).toISOString()
    : null
  const prevFromIso =
    rangeOption.days && fromIso
      ? new Date(new Date(fromIso).getTime() - rangeOption.days * 24 * 60 * 60 * 1000).toISOString()
      : null

  // ------------------------------------------------------------------ brands
  const { data: brandRows } = await db
    .from("brands")
    .select("id, name, slug, logo_url")
    .order("name", { ascending: true })

  const brandsList = (brandRows ?? []) as BrandLite[]
  const brandById = new Map<string, BrandLite>()
  for (const b of brandsList) brandById.set(b.id, b)
  const selectedBrand = filters.brandId ? brandById.get(filters.brandId) ?? null : null

  // ------------------------------------------ snapshot-restricted listing IDs
  // When `modelSlug` or `variantId` is pinned, we must restrict listings to
  // those with a matching `user_listing_board_model_data` snapshot. Computing
  // the allowed-id set up front lets us push the filter into both the
  // active-listings and orders queries.
  let snapshotListingIdAllowList: string[] | null = null
  if (filters.modelSlug || filters.variantId) {
    let snapQuery = db.from("user_listing_board_model_data").select("listing_id")
    if (selectedBrand?.slug) {
      snapQuery = snapQuery.eq("catalog_brand_slug", selectedBrand.slug)
    } else if (filters.brandId) {
      // Fallback: restrict by brand_id on the snapshot row when brand_slug is not available.
      snapQuery = snapQuery.eq("brand_id", filters.brandId)
    }
    if (filters.modelSlug) snapQuery = snapQuery.eq("catalog_model_slug", filters.modelSlug)
    if (filters.variantId)
      snapQuery = snapQuery.eq("converted_brand_model_variant_id", filters.variantId)

    const { data: snapIdRows } = await snapQuery.limit(ABSOLUTE_FETCH_CAP)
    snapshotListingIdAllowList = ((snapIdRows ?? []) as { listing_id: string }[]).map(
      (r) => r.listing_id,
    )
    if (snapshotListingIdAllowList.length === 0) {
      // Use a guaranteed-no-match sentinel so downstream queries return empty.
      snapshotListingIdAllowList = ["00000000-0000-0000-0000-000000000000"]
    }
  }

  // -------------------------------------------------------------- listings
  let inventoryQuery = db
    .from("listings")
    .select(LISTINGS_SELECT)
    .eq("section", "surfboards")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(ABSOLUTE_FETCH_CAP)

  if (filters.brandId) inventoryQuery = inventoryQuery.eq("brand_id", filters.brandId)
  if (filters.boardType) {
    const boardTypeVals = listingBoardTypeDbValuesForFilter(filters.boardType)
    if (boardTypeVals.length === 1) {
      inventoryQuery = inventoryQuery.eq("board_type", boardTypeVals[0])
    } else if (boardTypeVals.length > 1) {
      inventoryQuery = inventoryQuery.in("board_type", boardTypeVals)
    }
  }
  if (filters.condition) inventoryQuery = inventoryQuery.eq("condition", filters.condition)
  if (filters.state) inventoryQuery = inventoryQuery.eq("state", filters.state.toUpperCase())
  if (snapshotListingIdAllowList) {
    inventoryQuery = inventoryQuery.in("id", snapshotListingIdAllowList)
  }

  const { data: inventoryRowsRaw, error: inventoryError } = await inventoryQuery
  if (inventoryError) warnings.push(`Active inventory query failed: ${inventoryError.message}`)
  const activeListings = (inventoryRowsRaw ?? []) as ListingRow[]
  if (activeListings.length === ABSOLUTE_FETCH_CAP) {
    warnings.push(
      `Active inventory truncated at ${ABSOLUTE_FETCH_CAP.toLocaleString()} rows — totals reflect the cap.`,
    )
  }

  // ---------------------------------------------- new listings (current + prev)
  let newListingsCurrentQuery = db
    .from("listings")
    .select("id, brand_id, board_type, condition, price, created_at, status, state")
    .eq("section", "surfboards")
  if (fromIso) newListingsCurrentQuery = newListingsCurrentQuery.gte("created_at", fromIso)
  newListingsCurrentQuery = newListingsCurrentQuery.lte("created_at", toIso).limit(ABSOLUTE_FETCH_CAP)
  if (filters.brandId) newListingsCurrentQuery = newListingsCurrentQuery.eq("brand_id", filters.brandId)
  if (filters.boardType) {
    const boardTypeVals = listingBoardTypeDbValuesForFilter(filters.boardType)
    if (boardTypeVals.length === 1) {
      newListingsCurrentQuery = newListingsCurrentQuery.eq("board_type", boardTypeVals[0])
    } else if (boardTypeVals.length > 1) {
      newListingsCurrentQuery = newListingsCurrentQuery.in("board_type", boardTypeVals)
    }
  }
  if (filters.condition) newListingsCurrentQuery = newListingsCurrentQuery.eq("condition", filters.condition)
  if (filters.state) newListingsCurrentQuery = newListingsCurrentQuery.eq("state", filters.state.toUpperCase())
  if (snapshotListingIdAllowList) {
    newListingsCurrentQuery = newListingsCurrentQuery.in("id", snapshotListingIdAllowList)
  }

  const { data: newListingsCurrent, error: newListingsCurrentError } = await newListingsCurrentQuery
  if (newListingsCurrentError) warnings.push(`New-listings query failed: ${newListingsCurrentError.message}`)
  const newListingsCurrentRows = (newListingsCurrent ?? []) as Pick<
    ListingRow,
    "id" | "brand_id" | "board_type" | "condition" | "price" | "created_at" | "status" | "state"
  >[]

  // -------------------------------------------------------------- orders
  const ordersFromIso = prevFromIso ?? fromIso
  let ordersQuery = db
    .from("orders")
    .select(ORDERS_SELECT_WITH_LISTINGS)
    .order("created_at", { ascending: false })
    .limit(ABSOLUTE_FETCH_CAP)

  if (ordersFromIso) ordersQuery = ordersQuery.gte("created_at", ordersFromIso)
  if (snapshotListingIdAllowList) {
    ordersQuery = ordersQuery.in("listing_id", snapshotListingIdAllowList)
  }

  const { data: rawOrders, error: ordersError } = await ordersQuery
  if (ordersError) warnings.push(`Orders query failed: ${ordersError.message}`)
  const allOrderRows = (rawOrders ?? []) as unknown as (Omit<OrderJoinedRow, "listings"> & {
    listings: ListingRow | ListingRow[] | null
  })[]

  // In-memory filter for the joined-listing predicates (brand, board type, condition, state, section)
  const surfboardOrders: OrderJoinedRow[] = []
  for (const o of allOrderRows) {
    const listing = pickFirstJoined(o.listings)
    if (!listing) continue
    if (listing.section !== "surfboards") continue
    if (filters.brandId && listing.brand_id !== filters.brandId) continue
    if (
      filters.boardType &&
      canonicalListingsBoardTypeKey(listing.board_type) !==
        canonicalListingsBoardTypeKey(filters.boardType)
    ) {
      continue
    }
    if (filters.condition && listing.condition !== filters.condition) continue
    if (
      filters.state &&
      (listing.state ?? "").toUpperCase() !== filters.state.toUpperCase()
    ) {
      continue
    }
    surfboardOrders.push({ ...o, listings: listing })
  }

  const currentOrders = surfboardOrders.filter((o) => {
    if (!fromIso) return o.created_at <= toIso
    return o.created_at >= fromIso && o.created_at <= toIso
  })
  const previousOrders = prevFromIso
    ? surfboardOrders.filter(
        (o) => o.created_at >= prevFromIso && fromIso !== null && o.created_at < fromIso,
      )
    : []

  // ---------------------------------------------------------- snapshot lookup
  const allListingIds = new Set<string>()
  for (const l of activeListings) allListingIds.add(l.id)
  for (const o of currentOrders) {
    const lid = pickFirstJoined(o.listings)?.id
    if (lid) allListingIds.add(lid)
  }
  const snapshotByListingId = new Map<string, SnapshotRow>()
  if (allListingIds.size > 0) {
    const ids = Array.from(allListingIds)
    // Chunk to keep `.in()` array sizes reasonable.
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data: snapRows } = await db
        .from("user_listing_board_model_data")
        .select(SNAPSHOT_SELECT)
        .in("listing_id", slice)
      for (const s of (snapRows ?? []) as SnapshotRow[]) {
        snapshotByListingId.set(s.listing_id, s)
      }
    }
  }

  // -------------------------------------------------------- variant catalog
  const variantIds = new Set<string>()
  for (const s of snapshotByListingId.values()) {
    if (s.converted_brand_model_variant_id) variantIds.add(s.converted_brand_model_variant_id)
  }
  const variantById = new Map<string, VariantRow>()
  if (variantIds.size > 0) {
    const ids = Array.from(variantIds)
    const CHUNK = 500
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK)
      const { data: varRows } = await db
        .from("brand_model_variants")
        .select(VARIANT_SELECT)
        .in("id", slice)
      for (const v of (varRows ?? []) as VariantRow[]) variantById.set(v.id, v)
    }
  }

  // ---------------------------------------------------------- profile lookup
  const profileIds = new Set<string>()
  for (const o of currentOrders) {
    if (o.buyer_id) profileIds.add(o.buyer_id)
    if (o.seller_id) profileIds.add(o.seller_id)
  }
  const profileById = new Map<string, ProfileLite>()
  if (profileIds.size > 0) {
    const { data: profileRows } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", Array.from(profileIds))
    for (const p of (profileRows ?? []) as ProfileLite[]) profileById.set(p.id, p)
  }

  // ----------------------------------------------------- selected model/variant
  const selectedModelName: string | null = filters.modelSlug
    ? findFirstSnapshotModelName(snapshotByListingId, filters.modelSlug) ?? filters.modelSlug
    : null
  const selectedVariantLabel: string | null = filters.variantId
    ? variantById.get(filters.variantId)
      ? variantCanonicalLabel(variantById.get(filters.variantId)!)
      : null
    : null

  // -------------------------------------------------------- variant coverage
  const variantCoverage = await loadVariantCoverage({
    db,
    currentOrders,
    snapshotByListingId,
    selectedBrandId: filters.brandId,
  })

  // ------------------------------------------------------------------- KPIs
  const confirmedOrders = currentOrders.filter((o) => o.status === "confirmed")
  const refundedOrders = currentOrders.filter(
    (o) => o.status === "refunded" || o.status === "refunding",
  )
  const nowMs = now.getTime()
  const kpis = computeKpis({
    activeListings,
    newListingsRows: newListingsCurrentRows,
    confirmedOrders,
    refundedCount: refundedOrders.length,
    nowMs,
  })

  const prevConfirmedOrders = previousOrders.filter((o) => o.status === "confirmed")
  let prevKpis: DashboardKpis | null = null
  if (prevFromIso) {
    prevKpis = computeKpis({
      activeListings,
      newListingsRows: newListingsCurrentRows.filter((r) => {
        if (!prevFromIso || !fromIso) return false
        return r.created_at >= prevFromIso && r.created_at < fromIso
      }),
      confirmedOrders: prevConfirmedOrders,
      refundedCount: previousOrders.filter(
        (o) => o.status === "refunded" || o.status === "refunding",
      ).length,
      nowMs,
    })
  }

  // ------------------------------------------------------------- daily series
  const series = buildDailySeries({
    fromIso,
    toIso,
    newListings: newListingsCurrentRows,
    confirmedOrders,
  })

  // ---------------------------------------------------------- dimension level
  const dimension = computeDimension(filters, selectedBrand, selectedModelName, selectedVariantLabel)

  // ---------------------------------------------- regroupable grouped rows
  const groupedRowsAll = aggregateAtDimension({
    dimension,
    activeListings,
    newListingsRows: newListingsCurrentRows,
    confirmedOrders,
    snapshotByListingId,
    variantById,
    brandById,
  })

  const groupedTopByInventory = [...groupedRowsAll]
    .sort((a, b) => b.activeInventory - a.activeInventory)
    .slice(0, 12)
  const groupedBestSellers = [...groupedRowsAll]
    .filter((r) => r.soldInRange > 0)
    .sort((a, b) => b.grossVolumeInRange - a.grossVolumeInRange)
    .slice(0, 12)
  const groupedSlowestMoving = [...groupedRowsAll]
    .filter((r) => r.activeInventory >= 3)
    .sort((a, b) => {
      const ar = a.sellThroughInRange ?? 0
      const br = b.sellThroughInRange ?? 0
      if (ar !== br) return ar - br
      return b.activeInventory - a.activeInventory
    })
    .slice(0, 12)
  const groupedPricingTable = [...groupedRowsAll]
    .filter((r) => r.soldInRange > 0)
    .sort((a, b) => b.soldInRange - a.soldInRange)
    .slice(0, 24)

  // ------------------------------------------------- orthogonal aggregations
  const boardTypeRows = aggregateByBoardType({ activeListings, confirmedOrders })
  const conditionRows = aggregateByCondition({ activeListings, confirmedOrders })
  const locationRows = aggregateByLocation({ activeListings, confirmedOrders })
  const priceDistribution = bucketSoldPrices(confirmedOrders)
  const priceRealization = computePriceRealization(confirmedOrders)
  const inventoryAging = computeInventoryAging(activeListings, nowMs)
  const daysToSellDistribution = computeDaysToSellDistribution(confirmedOrders)
  const topSellers = computeTopSellers(confirmedOrders, profileById)
  const channelMix = computeChannelMix(confirmedOrders)
  const soldHistory = buildSoldHistory(currentOrders, profileById, snapshotByListingId)

  // ------------------------------------------------------ cascading filter options
  const filterOptions = await buildFilterOptions({
    db,
    brandsList,
    activeListings,
    snapshotByListingId,
    filters,
    selectedBrand,
  })

  // ------------------------------------------------------------ viewing scope
  const viewingScope = buildViewingScope({
    filters,
    rangeLabel: rangeOption.label,
    selectedBrand,
    selectedModelName,
    selectedVariantLabel,
    kpis,
  })

  return {
    generatedAt: toIso,
    filters,
    rangeFromIso: fromIso,
    rangeToIso: toIso,
    rangeDays: rangeOption.days,
    dimension,
    viewingScope,
    filterOptions,
    kpis,
    prevKpis,
    series,
    groupedTopByInventory,
    groupedBestSellers,
    groupedSlowestMoving,
    groupedPricingTable,
    boardTypeRows,
    conditionRows,
    locationRows,
    priceDistribution,
    priceRealization,
    inventoryAging,
    daysToSellDistribution,
    topSellers,
    channelMix,
    soldHistory,
    variantCoverage,
    salesEventsStub: {
      configured: false,
      message:
        "Sales events / promotions analytics will populate here once promotional sales are wired up. The dashboard is structured to slot them in without a rewrite.",
    },
    warnings,
  }
}

// ---------------------------------------------------------------------------
// Dimension resolution
// ---------------------------------------------------------------------------

function computeDimension(
  filters: DashboardFilters,
  selectedBrand: BrandLite | null,
  selectedModelName: string | null,
  selectedVariantLabel: string | null,
): DashboardDimension {
  if (filters.variantId) {
    return {
      level: "leaf",
      singular: "listing",
      plural: "listings",
      parentScope:
        selectedVariantLabel ??
        ([selectedBrand?.name, selectedModelName].filter(Boolean).join(" · ") || null),
    }
  }
  if (filters.modelSlug) {
    return {
      level: "variant",
      singular: "variant",
      plural: "variants",
      parentScope:
        [selectedBrand?.name, selectedModelName].filter(Boolean).join(" · ") || null,
    }
  }
  if (filters.brandId) {
    return {
      level: "model",
      singular: "model",
      plural: "models",
      parentScope: selectedBrand?.name ?? null,
    }
  }
  return { level: "brand", singular: "brand", plural: "brands", parentScope: null }
}

function findFirstSnapshotModelName(
  snapshotByListingId: Map<string, SnapshotRow>,
  modelSlug: string,
): string | null {
  for (const s of snapshotByListingId.values()) {
    if (s.catalog_model_slug === modelSlug && s.model_name?.trim()) return s.model_name.trim()
  }
  return null
}

// ---------------------------------------------------------------------------
// KPI helpers
// ---------------------------------------------------------------------------

function computeKpis(args: {
  activeListings: ListingRow[]
  newListingsRows: { price: number | string | null; created_at: string; status: string | null }[]
  confirmedOrders: OrderJoinedRow[]
  refundedCount: number
  nowMs: number
}): DashboardKpis {
  const askingPrices = args.activeListings
    .map((l) => toNumber(l.price))
    .filter((n): n is number => n != null && n > 0)

  const salePrices = args.confirmedOrders
    .map((o) => toNumber(o.amount))
    .filter((n): n is number => n != null && n >= 0)

  const platformFees = args.confirmedOrders
    .map((o) => toNumber(o.platform_fee))
    .filter((n): n is number => n != null && n >= 0)

  const grossVolume = salePrices.reduce((s, v) => s + v, 0)
  const totalFees = platformFees.reduce((s, v) => s + v, 0)

  const daysToSell: number[] = []
  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    if (!listing?.created_at) continue
    const diffMs = new Date(o.created_at).getTime() - new Date(listing.created_at).getTime()
    if (Number.isFinite(diffMs) && diffMs >= 0) {
      daysToSell.push(diffMs / (1000 * 60 * 60 * 24))
    }
  }

  // Inventory age (active listings only)
  const ageDays: number[] = []
  let staleInventoryCount = 0
  for (const l of args.activeListings) {
    const createdMs = new Date(l.created_at).getTime()
    if (!Number.isFinite(createdMs)) continue
    const age = (args.nowMs - createdMs) / (1000 * 60 * 60 * 24)
    if (age >= 0) {
      ageDays.push(age)
      if (age > 90) staleInventoryCount += 1
    }
  }

  // Sale ÷ ask ratio across confirmed orders with a known asking price
  const saleToAskRatios: number[] = []
  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    const ask = toNumber(listing?.price ?? null)
    const sale = toNumber(o.amount)
    if (ask != null && ask > 0 && sale != null && sale >= 0) {
      saleToAskRatios.push(sale / ask)
    }
  }

  const totalSoldInRange = args.confirmedOrders.length
  const totalActiveInventory = args.activeListings.length
  const sellThroughDenom = totalSoldInRange + totalActiveInventory
  const sellThrough = sellThroughDenom > 0 ? totalSoldInRange / sellThroughDenom : null

  return {
    totalActiveInventory,
    totalNewListingsInRange: args.newListingsRows.length,
    totalSoldInRange,
    grossSalesVolumeInRange: grossVolume,
    platformFeesInRange: totalFees,
    avgSalePriceInRange: avg(salePrices),
    medianSalePriceInRange: median(salePrices),
    avgDaysToSellInRange: avg(daysToSell),
    medianAskingPriceActive: median(askingPrices),
    sellThroughInRange: sellThrough,
    refundedCountInRange: args.refundedCount,
    medianInventoryAgeDays: median(ageDays),
    staleInventoryCount,
    avgSaleToAskRatio: avg(saleToAskRatios),
  }
}

// ---------------------------------------------------------------------------
// Catalog grouping (the heart of the regrouping cards)
// ---------------------------------------------------------------------------

type GroupBucket = {
  groupId: string
  groupLabel: string
  isUncatalogued: boolean
  activeInventory: number
  newListings: number
  askingPrices: number[]
  soldOrders: OrderJoinedRow[]
}

function aggregateAtDimension(args: {
  dimension: DashboardDimension
  activeListings: ListingRow[]
  newListingsRows: {
    id: string
    brand_id: string | null
    price: number | string | null
    created_at: string
    status: string | null
  }[]
  confirmedOrders: OrderJoinedRow[]
  snapshotByListingId: Map<string, SnapshotRow>
  variantById: Map<string, VariantRow>
  brandById: Map<string, BrandLite>
}): DashboardGroupedRow[] {
  const { dimension } = args
  const buckets = new Map<string, GroupBucket>()

  function pushBucket(key: string, label: string, isUncatalogued: boolean): GroupBucket {
    let b = buckets.get(key)
    if (!b) {
      b = {
        groupId: key,
        groupLabel: label,
        isUncatalogued,
        activeInventory: 0,
        newListings: 0,
        askingPrices: [],
        soldOrders: [],
      }
      buckets.set(key, b)
    }
    return b
  }

  function classifyByListing(
    listing: ListingRow | { id: string; brand_id: string | null; price: number | string | null },
  ): { key: string; label: string; isUncatalogued: boolean } {
    if (dimension.level === "brand") {
      const brandId = listing.brand_id ?? null
      if (!brandId) return { key: SENTINEL_UNBRANDED, label: "Unbranded / shaper", isUncatalogued: true }
      const brand = args.brandById.get(brandId)
      return {
        key: brandId,
        label: brand?.name?.trim() || "Unknown brand",
        isUncatalogued: false,
      }
    }

    const snap = args.snapshotByListingId.get(listing.id)

    if (dimension.level === "model") {
      if (!snap?.catalog_model_slug) {
        return {
          key: SENTINEL_UNCATALOGUED_MODEL,
          label: "Uncatalogued (no model snapshot)",
          isUncatalogued: true,
        }
      }
      return {
        key: snap.catalog_model_slug,
        label: snap.model_name?.trim() || snap.catalog_model_slug,
        isUncatalogued: false,
      }
    }

    if (dimension.level === "variant") {
      if (!snap) {
        return {
          key: SENTINEL_UNCATALOGUED_VARIANT,
          label: "Uncatalogued (no snapshot)",
          isUncatalogued: true,
        }
      }
      if (snap.converted_brand_model_variant_id) {
        const variant = args.variantById.get(snap.converted_brand_model_variant_id)
        if (variant) {
          return {
            key: snap.converted_brand_model_variant_id,
            label: variantCanonicalLabel(variant),
            isUncatalogued: false,
          }
        }
      }
      return {
        key: variantSyntheticKey(snap),
        label: variantSyntheticLabel(snap),
        isUncatalogued: false,
      }
    }

    // leaf — single bucket
    return { key: "leaf", label: dimension.parentScope ?? "This selection", isUncatalogued: false }
  }

  for (const l of args.activeListings) {
    const cls = classifyByListing(l)
    const b = pushBucket(cls.key, cls.label, cls.isUncatalogued)
    b.activeInventory += 1
    const ask = toNumber(l.price)
    if (ask != null && ask > 0) b.askingPrices.push(ask)
  }

  for (const r of args.newListingsRows) {
    const cls = classifyByListing(r)
    const b = pushBucket(cls.key, cls.label, cls.isUncatalogued)
    b.newListings += 1
  }

  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    if (!listing) continue
    const cls = classifyByListing(listing)
    const b = pushBucket(cls.key, cls.label, cls.isUncatalogued)
    b.soldOrders.push(o)
  }

  const rows: DashboardGroupedRow[] = []
  for (const b of buckets.values()) {
    const sales = b.soldOrders
      .map((o) => toNumber(o.amount))
      .filter((n): n is number => n != null && n >= 0)
    const daysToSell: number[] = []
    for (const o of b.soldOrders) {
      const listing = pickFirstJoined(o.listings)
      if (!listing?.created_at) continue
      const diffMs = new Date(o.created_at).getTime() - new Date(listing.created_at).getTime()
      if (Number.isFinite(diffMs) && diffMs >= 0) {
        daysToSell.push(diffMs / (1000 * 60 * 60 * 24))
      }
    }
    const denom = b.activeInventory + b.soldOrders.length
    rows.push({
      groupId: b.groupId,
      groupLabel: b.groupLabel,
      isUncatalogued: b.isUncatalogued,
      activeInventory: b.activeInventory,
      newListings: b.newListings,
      soldInRange: b.soldOrders.length,
      grossVolumeInRange: sales.reduce((s, v) => s + v, 0),
      avgSalePriceInRange: avg(sales),
      medianSalePriceInRange: median(sales),
      medianAskingActive: median(b.askingPrices),
      sellThroughInRange: denom > 0 ? b.soldOrders.length / denom : null,
      avgDaysToSellInRange: avg(daysToSell),
    })
  }

  return rows
}

// ---------------------------------------------------------------------------
// Orthogonal aggregations (re-scope only)
// ---------------------------------------------------------------------------

function aggregateByBoardType(args: {
  activeListings: ListingRow[]
  confirmedOrders: OrderJoinedRow[]
}): DashboardBoardTypeRow[] {
  const buckets = new Map<
    string,
    { raw: string; activeInventory: number; soldOrders: OrderJoinedRow[] }
  >()

  function bucketKey(value: string | null | undefined): string {
    const canonical = canonicalListingsBoardTypeKey(value)
    return canonical || "__unspecified"
  }

  function getBucket(raw: string | null | undefined) {
    const k = bucketKey(raw)
    let b = buckets.get(k)
    if (!b) {
      b = { raw: k === "__unspecified" ? "" : k, activeInventory: 0, soldOrders: [] }
      buckets.set(k, b)
    }
    return b
  }

  for (const l of args.activeListings) getBucket(l.board_type).activeInventory += 1
  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    getBucket(listing?.board_type).soldOrders.push(o)
  }

  const rows: DashboardBoardTypeRow[] = []
  for (const b of buckets.values()) {
    const sales = b.soldOrders
      .map((o) => toNumber(o.amount))
      .filter((n): n is number => n != null && n >= 0)
    const denom = b.activeInventory + b.soldOrders.length
    rows.push({
      boardType: b.raw,
      boardTypeLabel: boardTypeLabel(b.raw),
      activeInventory: b.activeInventory,
      soldInRange: b.soldOrders.length,
      grossVolumeInRange: sales.reduce((s, v) => s + v, 0),
      avgSalePriceInRange: avg(sales),
      medianSalePriceInRange: median(sales),
      sellThroughInRange: denom > 0 ? b.soldOrders.length / denom : null,
    })
  }
  rows.sort((a, b) => b.activeInventory + b.soldInRange - (a.activeInventory + a.soldInRange))
  return rows
}

function aggregateByCondition(args: {
  activeListings: ListingRow[]
  confirmedOrders: OrderJoinedRow[]
}): DashboardConditionRow[] {
  const buckets = new Map<
    string,
    {
      raw: string
      activeInventory: number
      askingPrices: number[]
      soldOrders: OrderJoinedRow[]
    }
  >()

  function getBucket(raw: string | null | undefined) {
    const v = (raw ?? "").trim().toLowerCase() || "__unspecified"
    let b = buckets.get(v)
    if (!b) {
      b = {
        raw: v === "__unspecified" ? "" : (raw ?? "").trim(),
        activeInventory: 0,
        askingPrices: [],
        soldOrders: [],
      }
      buckets.set(v, b)
    }
    return b
  }

  for (const l of args.activeListings) {
    const b = getBucket(l.condition)
    b.activeInventory += 1
    const ask = toNumber(l.price)
    if (ask != null && ask > 0) b.askingPrices.push(ask)
  }
  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    getBucket(listing?.condition).soldOrders.push(o)
  }

  const rows: DashboardConditionRow[] = []
  for (const b of buckets.values()) {
    const sales = b.soldOrders
      .map((o) => toNumber(o.amount))
      .filter((n): n is number => n != null && n >= 0)
    rows.push({
      condition: b.raw || "unknown",
      conditionLabel: conditionLabel(b.raw),
      activeInventory: b.activeInventory,
      soldInRange: b.soldOrders.length,
      avgSalePriceInRange: avg(sales),
      medianSalePriceInRange: median(sales),
      medianAskingActive: median(b.askingPrices),
    })
  }

  const orderIndex = (c: string) => (CONDITION_ORDER as readonly string[]).indexOf(c as ConditionKey)
  rows.sort((a, b) => {
    const ai = orderIndex(a.condition)
    const bi = orderIndex(b.condition)
    if (ai === -1 && bi === -1) return 0
    if (ai === -1) return 1
    if (bi === -1) return -1
    return ai - bi
  })
  return rows
}

function aggregateByLocation(args: {
  activeListings: ListingRow[]
  confirmedOrders: OrderJoinedRow[]
}): DashboardLocationRow[] {
  const buckets = new Map<
    string,
    { state: string; activeInventory: number; soldOrders: OrderJoinedRow[] }
  >()

  function getBucket(state: string | null | undefined) {
    const s = (state ?? "").trim().toUpperCase() || "—"
    let b = buckets.get(s)
    if (!b) {
      b = { state: s, activeInventory: 0, soldOrders: [] }
      buckets.set(s, b)
    }
    return b
  }

  for (const l of args.activeListings) getBucket(l.state).activeInventory += 1
  for (const o of args.confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    getBucket(listing?.state).soldOrders.push(o)
  }

  const rows: DashboardLocationRow[] = []
  for (const b of buckets.values()) {
    const sales = b.soldOrders
      .map((o) => toNumber(o.amount))
      .filter((n): n is number => n != null && n >= 0)
    rows.push({
      state: b.state,
      city: null,
      activeInventory: b.activeInventory,
      soldInRange: b.soldOrders.length,
      grossVolumeInRange: sales.reduce((s, v) => s + v, 0),
      avgSalePriceInRange: avg(sales),
    })
  }
  rows.sort(
    (a, b) => b.activeInventory + b.soldInRange - (a.activeInventory + a.soldInRange),
  )
  return rows.slice(0, ORTHOGONAL_LOCATION_LIMIT)
}

function bucketSoldPrices(orders: OrderJoinedRow[]): DashboardPriceBucketRow[] {
  const counts = PRICE_BUCKETS.map(() => 0)
  let total = 0
  for (const o of orders) {
    const amt = toNumber(o.amount)
    if (amt == null || amt < 0) continue
    total += 1
    for (let i = 0; i < PRICE_BUCKETS.length; i++) {
      const b = PRICE_BUCKETS[i]
      if (amt >= b.min && (b.max == null || amt < b.max)) {
        counts[i] += 1
        break
      }
    }
  }
  return PRICE_BUCKETS.map((b, i) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    count: counts[i],
    share: total > 0 ? counts[i] / total : 0,
  }))
}

// ---------------------------------------------------------------------------
// Price realization (sale vs ask)
// ---------------------------------------------------------------------------

const DISCOUNT_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "Sold over ask", test: (d) => d <= -0.02 },
  { label: "At ask (±2%)", test: (d) => d > -0.02 && d < 0.02 },
  { label: "1–5% under", test: (d) => d >= 0.02 && d < 0.05 },
  { label: "5–10% under", test: (d) => d >= 0.05 && d < 0.1 },
  { label: "10–20% under", test: (d) => d >= 0.1 && d < 0.2 },
  { label: "20%+ under", test: (d) => d >= 0.2 },
]

function buildDistribution(values: number[], specs: { label: string; test: (v: number) => boolean }[]): DashboardDistributionBucket[] {
  const counts = specs.map(() => 0)
  let total = 0
  for (const v of values) {
    for (let i = 0; i < specs.length; i++) {
      if (specs[i].test(v)) {
        counts[i] += 1
        total += 1
        break
      }
    }
  }
  return specs.map((s, i) => ({
    label: s.label,
    count: counts[i],
    share: total > 0 ? counts[i] / total : 0,
  }))
}

function computePriceRealization(confirmedOrders: OrderJoinedRow[]): DashboardPriceRealization {
  const ratios: number[] = []
  const discounts: number[] = []
  let atOrAboveAsk = 0
  const byCond = new Map<string, { ratios: number[]; discounts: number[] }>()

  for (const o of confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    const ask = toNumber(listing?.price ?? null)
    const sale = toNumber(o.amount)
    if (ask == null || ask <= 0 || sale == null || sale < 0) continue
    const ratio = sale / ask
    const discount = 1 - ratio
    ratios.push(ratio)
    discounts.push(discount)
    if (ratio >= 0.98) atOrAboveAsk += 1
    const condKey = (listing?.condition ?? "").trim().toLowerCase() || "unknown"
    const bucket = byCond.get(condKey) ?? { ratios: [], discounts: [] }
    bucket.ratios.push(ratio)
    bucket.discounts.push(discount)
    byCond.set(condKey, bucket)
  }

  const buckets = buildDistribution(
    discounts,
    DISCOUNT_BUCKETS.map((b) => ({ label: b.label, test: b.test })),
  )

  const byCondition = Array.from(byCond.entries())
    .map(([condition, b]) => ({
      condition,
      conditionLabel: conditionLabel(condition),
      sampleSize: b.ratios.length,
      avgDiscountPct: avg(b.discounts),
      avgSaleToAskRatio: avg(b.ratios),
    }))
    .sort((a, b) => {
      const ai = (CONDITION_ORDER as readonly string[]).indexOf(a.condition as ConditionKey)
      const bi = (CONDITION_ORDER as readonly string[]).indexOf(b.condition as ConditionKey)
      if (ai === -1 && bi === -1) return b.sampleSize - a.sampleSize
      if (ai === -1) return 1
      if (bi === -1) return -1
      return ai - bi
    })

  return {
    sampleSize: ratios.length,
    avgSaleToAskRatio: avg(ratios),
    medianSaleToAskRatio: median(ratios),
    avgDiscountPct: avg(discounts),
    soldAtOrAboveAskShare: ratios.length > 0 ? atOrAboveAsk / ratios.length : null,
    buckets,
    byCondition,
  }
}

// ---------------------------------------------------------------------------
// Inventory aging
// ---------------------------------------------------------------------------

const AGE_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "≤ 7 days", test: (d) => d <= 7 },
  { label: "8–30 days", test: (d) => d > 7 && d <= 30 },
  { label: "31–60 days", test: (d) => d > 30 && d <= 60 },
  { label: "61–90 days", test: (d) => d > 60 && d <= 90 },
  { label: "90+ days", test: (d) => d > 90 },
]

function computeInventoryAging(activeListings: ListingRow[], nowMs: number): DashboardInventoryAging {
  const ages: number[] = []
  let staleCount = 0
  for (const l of activeListings) {
    const createdMs = new Date(l.created_at).getTime()
    if (!Number.isFinite(createdMs)) continue
    const age = (nowMs - createdMs) / (1000 * 60 * 60 * 24)
    if (age < 0) continue
    ages.push(age)
    if (age > 90) staleCount += 1
  }
  return {
    activeCount: ages.length,
    medianAgeDays: median(ages),
    avgAgeDays: avg(ages),
    staleCount,
    staleShare: ages.length > 0 ? staleCount / ages.length : null,
    buckets: buildDistribution(ages, AGE_BUCKETS),
  }
}

// ---------------------------------------------------------------------------
// Days-to-sell distribution
// ---------------------------------------------------------------------------

const DAYS_TO_SELL_BUCKETS: { label: string; test: (d: number) => boolean }[] = [
  { label: "≤ 7 days", test: (d) => d <= 7 },
  { label: "8–14 days", test: (d) => d > 7 && d <= 14 },
  { label: "15–30 days", test: (d) => d > 14 && d <= 30 },
  { label: "31–60 days", test: (d) => d > 30 && d <= 60 },
  { label: "61–90 days", test: (d) => d > 60 && d <= 90 },
  { label: "90+ days", test: (d) => d > 90 },
]

function computeDaysToSellDistribution(confirmedOrders: OrderJoinedRow[]): DashboardDistributionBucket[] {
  const days: number[] = []
  for (const o of confirmedOrders) {
    const listing = pickFirstJoined(o.listings)
    if (!listing?.created_at) continue
    const diffMs = new Date(o.created_at).getTime() - new Date(listing.created_at).getTime()
    if (Number.isFinite(diffMs) && diffMs >= 0) days.push(diffMs / (1000 * 60 * 60 * 24))
  }
  return buildDistribution(days, DAYS_TO_SELL_BUCKETS)
}

// ---------------------------------------------------------------------------
// Seller leaderboard
// ---------------------------------------------------------------------------

function computeTopSellers(
  confirmedOrders: OrderJoinedRow[],
  profileById: Map<string, ProfileLite>,
): DashboardSellerRow[] {
  const buckets = new Map<string, { sales: number[] }>()
  for (const o of confirmedOrders) {
    if (!o.seller_id) continue
    const sale = toNumber(o.amount)
    const b = buckets.get(o.seller_id) ?? { sales: [] }
    if (sale != null && sale >= 0) b.sales.push(sale)
    else b.sales.push(0)
    buckets.set(o.seller_id, b)
  }
  return Array.from(buckets.entries())
    .map(([sellerId, b]) => ({
      sellerId,
      displayName: profileById.get(sellerId)?.display_name ?? null,
      soldInRange: b.sales.length,
      grossVolumeInRange: b.sales.reduce((s, v) => s + v, 0),
      avgSalePriceInRange: avg(b.sales),
    }))
    .sort((a, b) => b.grossVolumeInRange - a.grossVolumeInRange || b.soldInRange - a.soldInRange)
    .slice(0, 10)
}

// ---------------------------------------------------------------------------
// Fulfillment & payment channel mix
// ---------------------------------------------------------------------------

function channelLabel(kind: "fulfillment" | "payment", raw: string | null | undefined): string {
  const v = (raw ?? "").trim().toLowerCase()
  if (!v) return "Unspecified"
  const fulfillment: Record<string, string> = {
    shipping: "Shipping",
    ship: "Shipping",
    local_pickup: "Local pickup",
    pickup: "Local pickup",
    local: "Local pickup",
    delivery: "Local delivery",
  }
  const payment: Record<string, string> = {
    card: "Card",
    stripe: "Card",
    apple_pay: "Apple Pay",
    google_pay: "Google Pay",
    paypal: "PayPal",
    cash: "Cash",
  }
  const map = kind === "fulfillment" ? fulfillment : payment
  return map[v] ?? v.replace(/[-_]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function computeChannelMix(confirmedOrders: OrderJoinedRow[]): DashboardChannelMix {
  function build(getter: (o: OrderJoinedRow) => string | null | undefined, kind: "fulfillment" | "payment"): DashboardChannelRow[] {
    const buckets = new Map<string, { count: number; gross: number }>()
    let total = 0
    for (const o of confirmedOrders) {
      const key = (getter(o) ?? "").trim().toLowerCase() || "__unspecified"
      const b = buckets.get(key) ?? { count: 0, gross: 0 }
      b.count += 1
      const amt = toNumber(o.amount)
      if (amt != null && amt >= 0) b.gross += amt
      buckets.set(key, b)
      total += 1
    }
    return Array.from(buckets.entries())
      .map(([key, b]) => ({
        key,
        label: channelLabel(kind, key === "__unspecified" ? "" : key),
        count: b.count,
        grossVolume: b.gross,
        share: total > 0 ? b.count / total : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }
  return {
    fulfillment: build((o) => o.fulfillment_method, "fulfillment"),
    payment: build((o) => o.payment_method, "payment"),
  }
}

// ---------------------------------------------------------------------------
// Daily series
// ---------------------------------------------------------------------------

function buildDailySeries(args: {
  fromIso: string | null
  toIso: string
  newListings: { created_at: string }[]
  confirmedOrders: OrderJoinedRow[]
}): DashboardSeriesPoint[] {
  const keys = buildDailyKeys(args.fromIso, args.toIso)
  const map = new Map<string, DashboardSeriesPoint>()
  for (const k of keys) map.set(k, { date: k, newListings: 0, sold: 0, grossVolume: 0 })
  for (const r of args.newListings) {
    const point = map.get(dayKey(r.created_at))
    if (point) point.newListings += 1
  }
  for (const o of args.confirmedOrders) {
    const point = map.get(dayKey(o.created_at))
    if (point) {
      point.sold += 1
      const amt = toNumber(o.amount)
      if (amt != null && amt >= 0) point.grossVolume += amt
    }
  }
  return keys.map((k) => map.get(k)!).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Sold history table
// ---------------------------------------------------------------------------

function buildSoldHistory(
  orders: OrderJoinedRow[],
  profileById: Map<string, ProfileLite>,
  snapshotByListingId: Map<string, SnapshotRow>,
): DashboardSoldHistoryRow[] {
  return orders.slice(0, HISTORY_TABLE_LIMIT).map((o) => {
    const listing = pickFirstJoined(o.listings)
    const amt = toNumber(o.amount) ?? 0
    const fee = toNumber(o.platform_fee)
    const askingPrice = toNumber(listing?.price ?? null)
    const daysToSell = listing?.created_at
      ? Math.max(
          0,
          Math.round(
            (new Date(o.created_at).getTime() - new Date(listing.created_at).getTime()) /
              (1000 * 60 * 60 * 24),
          ),
        )
      : null
    const seller = o.seller_id ? profileById.get(o.seller_id) ?? null : null
    const buyer = o.buyer_id ? profileById.get(o.buyer_id) ?? null : null
    const snap = listing ? snapshotByListingId.get(listing.id) ?? null : null
    return {
      orderId: o.id,
      orderNum: o.order_num ?? null,
      saleDate: o.created_at,
      amount: amt,
      platformFee: fee,
      status: o.status ?? "unknown",
      refundedAt: o.refunded_at ?? null,
      paymentMethod: o.payment_method ?? null,
      fulfillmentMethod: o.fulfillment_method ?? null,
      daysToSell,
      listing: {
        id: listing?.id ?? "",
        slug: listing?.slug ?? null,
        title: listing?.title?.trim() || "Untitled listing",
        brand: listing?.brand ?? null,
        brandId: listing?.brand_id ?? null,
        boardType: listing?.board_type ?? null,
        condition: listing?.condition ?? null,
        city: listing?.city ?? null,
        state: listing?.state ?? null,
        askingPrice,
        dimensions: listing ? formatDimensions(listing) : null,
        modelName: snap?.model_name?.trim() || null,
      },
      seller: { id: o.seller_id ?? "", displayName: seller?.display_name ?? null },
      buyer: { id: o.buyer_id ?? "", displayName: buyer?.display_name ?? null },
    }
  })
}

// ---------------------------------------------------------------------------
// Variant coverage (filtered)
// ---------------------------------------------------------------------------

async function loadVariantCoverage(args: {
  db: SupabaseClient
  currentOrders: OrderJoinedRow[]
  snapshotByListingId: Map<string, SnapshotRow>
  selectedBrandId: string | null
}): Promise<DashboardVariantCoverage> {
  const confirmed = args.currentOrders.filter((o) => o.status === "confirmed")
  const listingIds = confirmed.map((o) => o.listing_id).filter((id): id is string => Boolean(id))

  let withVariantInRange = 0
  const modelMap = new Map<string, { count: number; prices: number[] }>()
  for (const lid of listingIds) {
    const snap = args.snapshotByListingId.get(lid)
    if (!snap) continue
    if (snap.converted_brand_model_variant_id) withVariantInRange += 1
    const name = snap.model_name?.trim()
    if (name) {
      const bucket = modelMap.get(name) ?? { count: 0, prices: [] }
      bucket.count += 1
      const p = toNumber(snap.sold_price)
      if (p != null && p > 0) bucket.prices.push(p)
      modelMap.set(name, bucket)
    }
  }

  // All-time totals — scoped by brand when set so the card matches the rest of
  // the dashboard. Without a brand filter these are the whole-table totals.
  let totalSnapshotsQuery = args.db
    .from("user_listing_board_model_data")
    .select("*", { count: "exact", head: true })
  let withVariantQuery = args.db
    .from("user_listing_board_model_data")
    .select("*", { count: "exact", head: true })
    .not("converted_brand_model_variant_id", "is", null)
  if (args.selectedBrandId) {
    totalSnapshotsQuery = totalSnapshotsQuery.eq("brand_id", args.selectedBrandId)
    withVariantQuery = withVariantQuery.eq("brand_id", args.selectedBrandId)
  }
  const [{ count: totalSnapshots }, { count: variantSnapshots }] = await Promise.all([
    totalSnapshotsQuery,
    withVariantQuery,
  ])

  const topModels = Array.from(modelMap.entries())
    .map(([name, b]) => ({ modelName: name, count: b.count, avgSoldPrice: avg(b.prices) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return {
    totalSoldInRange: listingIds.length,
    withCatalogVariantInRange: withVariantInRange,
    coverageShareInRange: listingIds.length > 0 ? withVariantInRange / listingIds.length : null,
    totalSnapshotsAllTime: totalSnapshots ?? 0,
    withVariantAllTime: variantSnapshots ?? 0,
    topModels,
  }
}

// ---------------------------------------------------------------------------
// Cascading filter options
// ---------------------------------------------------------------------------

async function buildFilterOptions(args: {
  db: SupabaseClient
  brandsList: BrandLite[]
  activeListings: ListingRow[]
  snapshotByListingId: Map<string, SnapshotRow>
  filters: DashboardFilters
  selectedBrand: BrandLite | null
}): Promise<DashboardFilterOptions> {
  const { brandsList, activeListings, snapshotByListingId, filters, selectedBrand } = args

  // boardTypes & states — derive from current slice so options cascade.
  const boardTypeMap = new Map<string, number>()
  const stateMap = new Map<string, number>()
  const conditionMap = new Map<string, number>()
  for (const l of activeListings) {
    const canonical = canonicalListingsBoardTypeKey(l.board_type)
    if (canonical) boardTypeMap.set(canonical, (boardTypeMap.get(canonical) ?? 0) + 1)
    const st = l.state?.trim().toUpperCase()
    if (st) stateMap.set(st, (stateMap.get(st) ?? 0) + 1)
    const cond = l.condition?.trim().toLowerCase()
    if (cond) conditionMap.set(cond, (conditionMap.get(cond) ?? 0) + 1)
  }

  const boardTypes = Array.from(boardTypeMap.entries())
    .map(([value, count]) => ({ value, label: boardTypeLabel(value), count }))
    .sort((a, b) => a.label.localeCompare(b.label))

  const states = Array.from(stateMap.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value))

  const conditions = (CONDITION_ORDER as readonly string[]).map((value) => ({
    value,
    label: LISTING_CONDITION_LABELS[value] ?? value,
    count: conditionMap.get(value) ?? 0,
  }))

  // models — when brand is set: full `brand_models` catalog for that brand (same slug rule as
  // `/sell`: slugify(name) → `user_listing_board_model_data.catalog_model_slug`), plus snapshot
  // rows for counts and any snapshot-only slugs not yet in catalog.
  let models: { slug: string; name: string; count: number }[] = []
  if (selectedBrand && filters.brandId) {
    const snapshotCountBySlug = new Map<string, { name: string; count: number }>()
    let modelQuery = args.db
      .from("user_listing_board_model_data")
      .select("catalog_model_slug, model_name")
      .not("catalog_model_slug", "is", null)
    if (selectedBrand.slug) {
      modelQuery = modelQuery.eq("catalog_brand_slug", selectedBrand.slug)
    } else {
      modelQuery = modelQuery.eq("brand_id", filters.brandId)
    }
    const { data: modelRows } = await modelQuery.limit(ABSOLUTE_FETCH_CAP)
    for (const r of (modelRows ?? []) as { catalog_model_slug: string; model_name: string | null }[]) {
      const slug = r.catalog_model_slug
      if (!slug) continue
      const cur = snapshotCountBySlug.get(slug) ?? {
        name: r.model_name?.trim() || slug,
        count: 0,
      }
      cur.count += 1
      if (!cur.name && r.model_name?.trim()) cur.name = r.model_name.trim()
      snapshotCountBySlug.set(slug, cur)
    }

    const { data: catalogModelRows } = await args.db
      .from("brand_models")
      .select("name")
      .eq("brand_id", filters.brandId)
      .order("name", { ascending: true })

    const catalogNamesBySlug = new Map<string, Set<string>>()
    for (const row of (catalogModelRows ?? []) as { name: string }[]) {
      const rawName = row.name?.trim()
      if (!rawName) continue
      const slug = slugify(rawName)
      if (!slug) continue
      let nameSet = catalogNamesBySlug.get(slug)
      if (!nameSet) {
        nameSet = new Set()
        catalogNamesBySlug.set(slug, nameSet)
      }
      nameSet.add(rawName)
    }

    const catalogSlugs = new Set(catalogNamesBySlug.keys())
    models = Array.from(catalogNamesBySlug.entries()).map(([slug, names]) => ({
      slug,
      name: Array.from(names).sort((a, b) => a.localeCompare(b)).join(" · "),
      count: snapshotCountBySlug.get(slug)?.count ?? 0,
    }))

    for (const [slug, v] of snapshotCountBySlug) {
      if (catalogSlugs.has(slug)) continue
      models.push({ slug, name: v.name, count: v.count })
    }

    models.sort((a, b) => a.name.localeCompare(b.name))
  }

  // variants — only when brand+model set; from converted snapshots in scope.
  let variants: { id: string; label: string; count: number }[] = []
  if (selectedBrand && filters.modelSlug) {
    let variantQuery = args.db
      .from("user_listing_board_model_data")
      .select("converted_brand_model_variant_id")
      .not("converted_brand_model_variant_id", "is", null)
      .eq("catalog_model_slug", filters.modelSlug)
    if (selectedBrand.slug) {
      variantQuery = variantQuery.eq("catalog_brand_slug", selectedBrand.slug)
    } else if (filters.brandId) {
      variantQuery = variantQuery.eq("brand_id", filters.brandId)
    }
    const { data: variantSnapRows } = await variantQuery.limit(ABSOLUTE_FETCH_CAP)
    const counts = new Map<string, number>()
    for (const r of (variantSnapRows ?? []) as { converted_brand_model_variant_id: string }[]) {
      const id = r.converted_brand_model_variant_id
      counts.set(id, (counts.get(id) ?? 0) + 1)
    }
    if (counts.size > 0) {
      const ids = Array.from(counts.keys())
      const { data: varRows } = await args.db
        .from("brand_model_variants")
        .select(VARIANT_SELECT)
        .in("id", ids)
      const byId = new Map<string, VariantRow>()
      for (const v of (varRows ?? []) as VariantRow[]) byId.set(v.id, v)
      variants = Array.from(counts.entries())
        .map(([id, count]) => ({
          id,
          label: byId.has(id) ? variantCanonicalLabel(byId.get(id)!) : id,
          count,
        }))
        .sort((a, b) => b.count - a.count)
    }
  }

  // brands — always full list (so admins can pivot brand without clearing).
  const brands = brandsList.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))

  // Suppress noisy unused: snapshotByListingId is reserved for future cascading;
  // included here so callers see the surface.
  void snapshotByListingId

  return { brands, models, variants, boardTypes, conditions, states }
}

// ---------------------------------------------------------------------------
// Viewing scope
// ---------------------------------------------------------------------------

function buildViewingScope(args: {
  filters: DashboardFilters
  rangeLabel: string
  selectedBrand: BrandLite | null
  selectedModelName: string | null
  selectedVariantLabel: string | null
  kpis: DashboardKpis
}): DashboardViewingScope {
  const parts: string[] = []
  if (args.selectedBrand?.name) parts.push(args.selectedBrand.name)
  if (args.selectedModelName) parts.push(args.selectedModelName)
  if (args.selectedVariantLabel) parts.push(args.selectedVariantLabel)

  const primaryLabel = parts.length > 0 ? parts.join(" · ") : "All used surfboards"

  const secondary: string[] = []
  secondary.push(args.rangeLabel)
  if (args.filters.boardType) secondary.push(`Shape: ${boardTypeLabel(args.filters.boardType)}`)
  if (args.filters.condition) secondary.push(`Condition: ${conditionLabel(args.filters.condition)}`)
  if (args.filters.state) secondary.push(`State: ${args.filters.state.toUpperCase()}`)

  return {
    primaryLabel,
    secondaryParts: secondary,
    activeInventory: args.kpis.totalActiveInventory,
    soldInRange: args.kpis.totalSoldInRange,
  }
}
