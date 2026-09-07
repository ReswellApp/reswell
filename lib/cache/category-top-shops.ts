import { unstable_cache } from "next/cache"
import { listCategoryTopShops } from "@/lib/services/categoryTopShops"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { CategoryTopShop, CategoryTopShopSection } from "@/lib/types/category-top-shops"

export const CATEGORY_TOP_SHOPS_CACHE_TAG = "category-top-shops"
export const CATEGORY_TOP_SHOPS_REVALIDATE_SECONDS = 60 * 60

function createSupabaseForCategoryTopShops() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return createAnonSupabaseClient()
}

async function loadCategoryTopShopsUncached(
  section: CategoryTopShopSection,
): Promise<CategoryTopShop[]> {
  const supabase = createSupabaseForCategoryTopShops()
  return listCategoryTopShops(supabase, section)
}

const getCachedSurfboardTopShops = unstable_cache(
  () => loadCategoryTopShopsUncached("surfboards"),
  ["category-top-shops", "surfboards", "v2"],
  {
    revalidate: CATEGORY_TOP_SHOPS_REVALIDATE_SECONDS,
    tags: [CATEGORY_TOP_SHOPS_CACHE_TAG],
  },
)

const getCachedFinTopShops = unstable_cache(
  () => loadCategoryTopShopsUncached("fins"),
  ["category-top-shops", "fins", "v2"],
  {
    revalidate: CATEGORY_TOP_SHOPS_REVALIDATE_SECONDS,
    tags: [CATEGORY_TOP_SHOPS_CACHE_TAG],
  },
)

export async function getCachedCategoryTopShops(
  section: CategoryTopShopSection,
): Promise<CategoryTopShop[]> {
  if (section === "fins") return getCachedFinTopShops()
  return getCachedSurfboardTopShops()
}
