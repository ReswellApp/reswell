import { unstable_cache } from "next/cache"
import { listFinCatalogBrandIds } from "@/lib/db/fin-catalog-search"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Fin-tagged brand IDs — changes only when admins edit brand product categories. */
export const FIN_CATALOG_BRAND_IDS_CACHE_TAG = "fin-catalog-brand-ids"
export const FIN_CATALOG_BRAND_IDS_REVALIDATE_SECONDS = 60 * 60 * 24

async function loadFinCatalogBrandIds(): Promise<string[]> {
  const supabase = createAnonSupabaseClient()
  return listFinCatalogBrandIds(supabase)
}

const getCachedFinCatalogBrandIds = unstable_cache(
  loadFinCatalogBrandIds,
  ["fin-catalog-brand-ids"],
  {
    revalidate: FIN_CATALOG_BRAND_IDS_REVALIDATE_SECONDS,
    tags: [FIN_CATALOG_BRAND_IDS_CACHE_TAG],
  },
)

export async function getFinCatalogBrandIdsCached(): Promise<string[]> {
  return getCachedFinCatalogBrandIds()
}
