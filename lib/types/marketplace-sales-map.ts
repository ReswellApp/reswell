import type { UsaSalesMapGeometry } from "@/lib/utils/usa-sales-map-geometry"

/** Aggregated seller → buyer state flow for map arcs. */
export type MarketplaceSalesMapFlow = {
  sellerState: string
  buyerState: string
  count: number
  volumeUsd: number
}

/** Per-state activity for choropleth fills and tooltips. */
export type MarketplaceSalesMapStateStat = {
  state: string
  stateName: string
  /** Orders where the listing was in this state. */
  asSeller: number
  /** Orders where the buyer is associated with this state. */
  asBuyer: number
  volumeUsd: number
}

/** Individual sale pin — no PII, state-level only. */
export type MarketplaceSalesMapSale = {
  id: string
  sellerState: string
  buyerState: string
  amountUsd: number
  soldAt: string
  listingTitle: string | null
  section: string | null
  fulfillmentMethod: string | null
}

export type MarketplaceSalesMapTotals = {
  confirmedSales: number
  mappableSales: number
  statesSelling: number
  statesBuying: number
  crossStateSales: number
  volumeUsd: number
}

export type MarketplaceSalesMapPayload = {
  flows: MarketplaceSalesMapFlow[]
  stateStats: MarketplaceSalesMapStateStat[]
  recentSales: MarketplaceSalesMapSale[]
  totals: MarketplaceSalesMapTotals
  geometry: UsaSalesMapGeometry
  generatedAt: string
  truncated: boolean
}
