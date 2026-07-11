import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchConfirmedMarketplaceSalesForMap,
  fetchProfileLocalitiesForMap,
  type MarketplaceMapProfileLocalityRow,
  type MarketplaceSalesMapOrderWithListing,
  type MarketplaceSalesMapProfileRow,
} from "@/lib/db/marketplaceSalesMap"
import type {
  MarketplaceSalesMapFlow,
  MarketplaceSalesMapPayload,
  MarketplaceSalesMapSale,
  MarketplaceSalesMapStateStat,
} from "@/lib/types/marketplace-sales-map"
import {
  resolveProfileHomeState,
} from "@/lib/utils/profile-home-state"
import { toUsStateCode } from "@/lib/utils/us-state-code"
import { usStateDisplayName } from "@/lib/utils/us-state-names"
import { buildUsaSalesMapGeometry } from "@/lib/utils/usa-sales-map-geometry"

const RECENT_SALES_LIMIT = 48

type ShippingAddressJson = {
  address?: {
    state?: string | null
  } | null
} | null

function toAmount(value: number | string | null | undefined): number {
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function resolveProfileState(
  profile: MarketplaceSalesMapProfileRow | undefined,
): string | undefined {
  return resolveProfileHomeState(profile)
}

function buildUserCountsByState(
  profiles: MarketplaceMapProfileLocalityRow[],
): Record<string, number> {
  const counts: Record<string, number> = {}

  for (const profile of profiles) {
    const state = resolveProfileHomeState(profile)
    if (!state) continue
    counts[state] = (counts[state] ?? 0) + 1
  }

  return counts
}

function resolveSellerState(
  order: MarketplaceSalesMapOrderWithListing,
  profilesById: Map<string, MarketplaceSalesMapProfileRow>,
): string | undefined {
  const listingState = toUsStateCode(order.listing.state)
  if (listingState) return listingState

  if (order.seller_id) {
    const sellerState = resolveProfileState(profilesById.get(order.seller_id))
    if (sellerState) return sellerState
  }

  return undefined
}

function resolveBuyerState(
  order: MarketplaceSalesMapOrderWithListing,
  profilesById: Map<string, MarketplaceSalesMapProfileRow>,
): string | undefined {
  const shipping = order.shipping_address as ShippingAddressJson
  const shipState = toUsStateCode(shipping?.address?.state)
  if (shipState) return shipState

  if (order.buyer_id) {
    const buyerState = resolveProfileState(profilesById.get(order.buyer_id))
    if (buyerState) return buyerState
  }

  return undefined
}

function flowKey(sellerState: string, buyerState: string): string {
  return `${sellerState}->${buyerState}`
}

export function buildMarketplaceSalesMapPayload(args: {
  orders: MarketplaceSalesMapOrderWithListing[]
  profilesById: Map<string, MarketplaceSalesMapProfileRow>
  profileLocalities: MarketplaceMapProfileLocalityRow[]
  truncated: boolean
}): MarketplaceSalesMapPayload {
  const flowBuckets = new Map<string, MarketplaceSalesMapFlow>()
  const stateBuckets = new Map<string, MarketplaceSalesMapStateStat>()
  const recentSales: MarketplaceSalesMapSale[] = []

  let mappableSales = 0
  let crossStateSales = 0
  let volumeUsd = 0

  function touchState(state: string) {
    let bucket = stateBuckets.get(state)
    if (!bucket) {
      bucket = {
        state,
        stateName: usStateDisplayName(state),
        asSeller: 0,
        asBuyer: 0,
        volumeUsd: 0,
      }
      stateBuckets.set(state, bucket)
    }
    return bucket
  }

  for (const order of args.orders) {
    const amountUsd = toAmount(order.amount)
    volumeUsd += amountUsd

    const sellerState = resolveSellerState(order, args.profilesById)
    let buyerState = resolveBuyerState(order, args.profilesById)

    if (
      !buyerState &&
      sellerState &&
      (order.fulfillment_method ?? "").trim().toLowerCase() === "pickup"
    ) {
      buyerState = sellerState
    }

    if (!sellerState || !buyerState) continue

    mappableSales += 1
    if (sellerState !== buyerState) crossStateSales += 1

    const sellerBucket = touchState(sellerState)
    sellerBucket.asSeller += 1
    sellerBucket.volumeUsd += amountUsd

    const buyerBucket = touchState(buyerState)
    buyerBucket.asBuyer += 1
    if (buyerState !== sellerState) {
      buyerBucket.volumeUsd += amountUsd
    }

    const key = flowKey(sellerState, buyerState)
    const existing = flowBuckets.get(key)
    if (existing) {
      existing.count += 1
      existing.volumeUsd += amountUsd
    } else {
      flowBuckets.set(key, {
        sellerState,
        buyerState,
        count: 1,
        volumeUsd: amountUsd,
      })
    }

    if (recentSales.length < RECENT_SALES_LIMIT) {
      recentSales.push({
        id: order.id,
        sellerState,
        buyerState,
        amountUsd,
        soldAt: order.created_at,
        listingTitle: order.listing.title,
        section: order.listing.section,
        fulfillmentMethod: order.fulfillment_method,
      })
    }
  }

  const flows = [...flowBuckets.values()].sort((a, b) => b.count - a.count)
  const stateStats = [...stateBuckets.values()].sort(
    (a, b) => b.asSeller + b.asBuyer - (a.asSeller + a.asBuyer),
  )

  const statesSelling = stateStats.filter((row) => row.asSeller > 0).length
  const statesBuying = stateStats.filter((row) => row.asBuyer > 0).length
  const userCountsByState = buildUserCountsByState(args.profileLocalities)

  return {
    flows,
    stateStats,
    recentSales,
    userCountsByState,
    totals: {
      confirmedSales: args.orders.length,
      mappableSales,
      statesSelling,
      statesBuying,
      crossStateSales,
      volumeUsd,
    },
    geometry: buildUsaSalesMapGeometry({ flows, stateStats }),
    generatedAt: new Date().toISOString(),
    truncated: args.truncated,
  }
}

export async function loadMarketplaceSalesMap(
  supabase: SupabaseClient,
): Promise<MarketplaceSalesMapPayload> {
  const [salesResult, profileLocalities] = await Promise.all([
    fetchConfirmedMarketplaceSalesForMap(supabase),
    fetchProfileLocalitiesForMap(supabase),
  ])

  return buildMarketplaceSalesMapPayload({
    ...salesResult,
    profileLocalities,
  })
}
