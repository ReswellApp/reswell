import { revalidateTag } from "next/cache"
import { SELL_BRAND_CATALOG_MODELS_CACHE_TAG } from "@/lib/cache/sell-brand-catalog-models"
import { SELL_CATALOG_SEARCH_CACHE_TAG } from "@/lib/cache/sell-catalog-search"

function isNextCacheContextMissing(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes("static generation store missing") || message.includes("revalidateTag")
}

/**
 * Bust `/sell` catalog typeahead + trending-brand model lists after brand/model
 * writes or an Elasticsearch sell-catalog reindex.
 */
export function revalidateSellCatalogSearch(): void {
  try {
    revalidateTag(SELL_CATALOG_SEARCH_CACHE_TAG, "max")
    revalidateTag(SELL_BRAND_CATALOG_MODELS_CACHE_TAG, "max")
  } catch (error) {
    if (!isNextCacheContextMissing(error)) {
      console.error("[revalidateSellCatalogSearch]", error)
    }
  }
}
