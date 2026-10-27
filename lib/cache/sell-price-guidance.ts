import { unstable_cache } from "next/cache"
import { PRICE_GUIDE_CACHE_TAG, PRICE_GUIDE_REVALIDATE_SECONDS } from "@/lib/cache/price-guide"
import { getSellPriceGuidance } from "@/lib/services/sellPriceGuidance"
import { getDb } from "@/lib/supabase/db"
import type { SellPriceGuidance } from "@/lib/types/sell-price-guidance"
import type { SellPriceGuidanceQuery } from "@/lib/validations/sell-price-guidance"

export const SELL_PRICE_GUIDANCE_CACHE_TAG = "sell-price-guidance"

function cacheKey(query: SellPriceGuidanceQuery): string[] {
  return [
    "sell-price-guidance-v1",
    query.category_slug,
    query.brand_id,
    query.brand_model_id,
    query.condition ?? "",
  ]
}

export function getCachedSellPriceGuidance(
  query: SellPriceGuidanceQuery,
): Promise<SellPriceGuidance | null> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getSellPriceGuidance(supabase, query)
  }

  const cached = unstable_cache(
    async (): Promise<SellPriceGuidance | null> => {
      const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
      return getSellPriceGuidance(supabase, query)
    },
    cacheKey(query),
    {
      revalidate: PRICE_GUIDE_REVALIDATE_SECONDS,
      tags: [PRICE_GUIDE_CACHE_TAG, SELL_PRICE_GUIDANCE_CACHE_TAG],
    },
  )
  return cached()
}
