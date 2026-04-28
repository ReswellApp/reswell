/**
 * Shared types and constants for the used surfboard market dashboard.
 *
 * Lives in its own module so client components can import it without pulling
 * in `lib/supabase/server.ts` (which depends on `next/headers` and is server-only).
 */

export type DashboardRangeKey = "30d" | "90d" | "180d" | "365d" | "all"

export const DASHBOARD_RANGE_OPTIONS: { value: DashboardRangeKey; label: string; days: number | null }[] = [
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
  { value: "180d", label: "Last 180 days", days: 180 },
  { value: "365d", label: "Last 365 days", days: 365 },
  { value: "all", label: "All time", days: null },
]

/**
 * Filter set powering every section of the dashboard. Whenever a filter is
 * pinned (brand, model, variant), the dashboard drills one level deeper in the
 * catalog hierarchy: brand → model → variant.
 */
export type DashboardFilters = {
  range: DashboardRangeKey
  brandId: string | null
  /** Matches `user_listing_board_model_data.catalog_model_slug`. */
  modelSlug: string | null
  /** Matches `brand_model_variants.id` (only converted snapshots). */
  variantId: string | null
  boardType: string | null
  condition: string | null
  /** Two-letter US state code (`listings.state`). */
  state: string | null
}

/**
 * Catalog level the regrouping sections are currently grouping by — derived
 * from which catalog filters are pinned (brand → model → variant → leaf).
 */
export type DashboardDimension = {
  level: "brand" | "model" | "variant" | "leaf"
  singular: string
  plural: string
  /** e.g. "Channel Islands Surfboards" when grouping models within a brand. */
  parentScope: string | null
}

export type DashboardGroupedRow = {
  /** Stable id for `key` props (brand uuid · model slug · variant id · sentinel). */
  groupId: string
  groupLabel: string
  /** Whether this row represents listings that have no catalog snapshot yet. */
  isUncatalogued: boolean
  activeInventory: number
  newListings: number
  soldInRange: number
  grossVolumeInRange: number
  avgSalePriceInRange: number | null
  medianSalePriceInRange: number | null
  medianAskingActive: number | null
  sellThroughInRange: number | null
  avgDaysToSellInRange: number | null
}

export type DashboardKpis = {
  totalActiveInventory: number
  totalNewListingsInRange: number
  totalSoldInRange: number
  grossSalesVolumeInRange: number
  platformFeesInRange: number
  avgSalePriceInRange: number | null
  medianSalePriceInRange: number | null
  avgDaysToSellInRange: number | null
  medianAskingPriceActive: number | null
  sellThroughInRange: number | null
  refundedCountInRange: number
}

export type DashboardSeriesPoint = {
  date: string
  newListings: number
  sold: number
  grossVolume: number
}

export type DashboardBoardTypeRow = {
  boardType: string
  boardTypeLabel: string
  activeInventory: number
  soldInRange: number
  grossVolumeInRange: number
  avgSalePriceInRange: number | null
  medianSalePriceInRange: number | null
  sellThroughInRange: number | null
}

export type DashboardConditionRow = {
  condition: string
  conditionLabel: string
  activeInventory: number
  soldInRange: number
  avgSalePriceInRange: number | null
  medianSalePriceInRange: number | null
  medianAskingActive: number | null
}

export type DashboardLocationRow = {
  state: string
  city: string | null
  activeInventory: number
  soldInRange: number
  grossVolumeInRange: number
  avgSalePriceInRange: number | null
}

export type DashboardPriceBucketRow = {
  label: string
  min: number
  max: number | null
  count: number
  share: number
}

export type DashboardSoldHistoryRow = {
  orderId: string
  orderNum: string | null
  saleDate: string
  amount: number
  platformFee: number | null
  status: string
  refundedAt: string | null
  paymentMethod: string | null
  fulfillmentMethod: string | null
  daysToSell: number | null
  listing: {
    id: string
    slug: string | null
    title: string
    brand: string | null
    brandId: string | null
    boardType: string | null
    condition: string | null
    city: string | null
    state: string | null
    askingPrice: number | null
    dimensions: string | null
    /** Resolved model name from snapshot, when available. */
    modelName: string | null
  }
  seller: { id: string; displayName: string | null }
  buyer: { id: string; displayName: string | null }
}

export type DashboardVariantCoverage = {
  totalSoldInRange: number
  withCatalogVariantInRange: number
  coverageShareInRange: number | null
  totalSnapshotsAllTime: number
  withVariantAllTime: number
  topModels: { modelName: string; count: number; avgSoldPrice: number | null }[]
}

export type DashboardViewingScope = {
  /** "Channel Islands Surfboards" / "Channel Islands · Happy Everyday" / "All used surfboards". */
  primaryLabel: string
  /** Secondary tags shown next to primary: range, board type, condition, state, refunds, etc. */
  secondaryParts: string[]
  activeInventory: number
  soldInRange: number
}

export type DashboardFilterOptions = {
  brands: { id: string; name: string; slug: string | null }[]
  /** Populated only when `brandId` is set (cascading). */
  models: { slug: string; name: string; count: number }[]
  /** Populated only when `modelSlug` is set (cascading). */
  variants: { id: string; label: string; count: number }[]
  /** Computed from the currently-filtered slice (cascading). */
  boardTypes: { value: string; label: string; count: number }[]
  /** Always all six sellable conditions; counts reflect the slice. */
  conditions: { value: string; label: string; count: number }[]
  /** Computed from the currently-filtered slice (cascading). */
  states: { value: string; count: number }[]
}

export type UsedBoardMarketDashboard = {
  generatedAt: string
  filters: DashboardFilters
  rangeFromIso: string | null
  rangeToIso: string
  rangeDays: number | null
  dimension: DashboardDimension
  viewingScope: DashboardViewingScope
  filterOptions: DashboardFilterOptions
  kpis: DashboardKpis
  prevKpis: DashboardKpis | null
  series: DashboardSeriesPoint[]
  /** Regroupable cards — group by `dimension.level`. */
  groupedTopByInventory: DashboardGroupedRow[]
  groupedBestSellers: DashboardGroupedRow[]
  groupedSlowestMoving: DashboardGroupedRow[]
  groupedPricingTable: DashboardGroupedRow[]
  /** Orthogonal — re-scope only. */
  boardTypeRows: DashboardBoardTypeRow[]
  conditionRows: DashboardConditionRow[]
  locationRows: DashboardLocationRow[]
  priceDistribution: DashboardPriceBucketRow[]
  soldHistory: DashboardSoldHistoryRow[]
  variantCoverage: DashboardVariantCoverage
  /** Empty until sales-event/promotion data is wired up. */
  salesEventsStub: { configured: boolean; message: string }
  warnings: string[]
}
