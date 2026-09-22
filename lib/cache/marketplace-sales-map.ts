import { unstable_cache } from "next/cache"
import { loadMarketplaceSalesMap } from "@/lib/services/marketplaceSalesMap"
import type { MarketplaceSalesMapPayload } from "@/lib/types/marketplace-sales-map"
import { getDb } from "@/lib/supabase/db"

/** Hourly cache for the public `/map` sales-flow visualization. */
export const MARKETPLACE_SALES_MAP_CACHE_TAG = "marketplace-sales-map"
export const MARKETPLACE_SALES_MAP_REVALIDATE_SECONDS = 60 * 60

const getCachedMarketplaceSalesMapPayload = unstable_cache(
  async (): Promise<MarketplaceSalesMapPayload> => {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return loadMarketplaceSalesMap(supabase)
  },
  ["marketplace-sales-map-v4"],
  {
    revalidate: MARKETPLACE_SALES_MAP_REVALIDATE_SECONDS,
    tags: [MARKETPLACE_SALES_MAP_CACHE_TAG],
  },
)

export function getCachedMarketplaceSalesMap(): Promise<MarketplaceSalesMapPayload> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return loadMarketplaceSalesMap(supabase)
  }
  return getCachedMarketplaceSalesMapPayload()
}
