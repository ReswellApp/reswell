import { unstable_cache } from "next/cache"
import { getDb } from "@/lib/supabase/db"
import type { PriceGuideCategorySlug } from "@/lib/price-guide/categories"
import {
  getPriceGuideBrandPage,
  getPriceGuideCategoryPage,
  getPriceGuideHub,
  getPriceGuideModelPage,
} from "@/lib/services/priceGuidePublic"
import type {
  PriceGuideBrandPage,
  PriceGuideCategoryPage,
  PriceGuideHub,
  PriceGuideModelPage,
} from "@/lib/types/price-guide"

export const PRICE_GUIDE_CACHE_TAG = "price-guide"
export const PRICE_GUIDE_REVALIDATE_SECONDS = 60 * 60

const getCachedHubPayload = unstable_cache(
  async (): Promise<PriceGuideHub> => {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getPriceGuideHub(supabase)
  },
  ["price-guide-hub-v1"],
  { revalidate: PRICE_GUIDE_REVALIDATE_SECONDS, tags: [PRICE_GUIDE_CACHE_TAG] },
)

export function getCachedPriceGuideHub(): Promise<PriceGuideHub> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getPriceGuideHub(supabase)
  }
  return getCachedHubPayload()
}

export function getCachedPriceGuideCategory(
  category: PriceGuideCategorySlug,
): Promise<PriceGuideCategoryPage> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getPriceGuideCategoryPage(supabase, category)
  }
  const cached = unstable_cache(
    async (): Promise<PriceGuideCategoryPage> => {
      const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
      return getPriceGuideCategoryPage(supabase, category)
    },
    ["price-guide-category-v1", category],
    { revalidate: PRICE_GUIDE_REVALIDATE_SECONDS, tags: [PRICE_GUIDE_CACHE_TAG] },
  )
  return cached()
}

export function getCachedPriceGuideBrand(
  category: PriceGuideCategorySlug,
  brandSlug: string,
): Promise<PriceGuideBrandPage | null> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getPriceGuideBrandPage(supabase, category, brandSlug)
  }
  const cached = unstable_cache(
    async (): Promise<PriceGuideBrandPage | null> => {
      const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
      return getPriceGuideBrandPage(supabase, category, brandSlug)
    },
    ["price-guide-brand-v1", category, brandSlug],
    { revalidate: PRICE_GUIDE_REVALIDATE_SECONDS, tags: [PRICE_GUIDE_CACHE_TAG] },
  )
  return cached()
}

export function getCachedPriceGuideModel(
  category: PriceGuideCategorySlug,
  brandSlug: string,
  modelSlug: string,
): Promise<PriceGuideModelPage | null> {
  if (process.env.NODE_ENV === "development") {
    const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
    return getPriceGuideModelPage(supabase, category, brandSlug, modelSlug)
  }
  const cached = unstable_cache(
    async (): Promise<PriceGuideModelPage | null> => {
      const supabase = getDb({ consistency: "eventual", purpose: "analytics" })
      return getPriceGuideModelPage(supabase, category, brandSlug, modelSlug)
    },
    ["price-guide-model-v1", category, brandSlug, modelSlug],
    { revalidate: PRICE_GUIDE_REVALIDATE_SECONDS, tags: [PRICE_GUIDE_CACHE_TAG] },
  )
  return cached()
}
