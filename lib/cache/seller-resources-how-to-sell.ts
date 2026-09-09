import { unstable_cache } from "next/cache"
import { getHowToSellGuidePayload } from "@/lib/services/sellerResourcesHowToSell"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { HowToSellGuidePayload } from "@/lib/types/seller-resources-how-to-sell"

export const HOW_TO_SELL_GUIDE_CACHE_TAG = "seller-resources-how-to-sell"
export const HOW_TO_SELL_GUIDE_REVALIDATE_SECONDS = 60 * 60

function createSupabaseForHowToSellGuide() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return createAnonSupabaseClient()
}

async function loadHowToSellGuidePayload(): Promise<HowToSellGuidePayload> {
  const supabase = createSupabaseForHowToSellGuide()
  return getHowToSellGuidePayload(supabase)
}

export const getCachedHowToSellGuidePayload = unstable_cache(
  loadHowToSellGuidePayload,
  ["seller-resources-how-to-sell", "v2"],
  {
    revalidate: HOW_TO_SELL_GUIDE_REVALIDATE_SECONDS,
    tags: [HOW_TO_SELL_GUIDE_CACHE_TAG],
  },
)
