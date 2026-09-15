import type { SupabaseClient } from "@supabase/supabase-js"
import { META_CATALOG_LISTING_SELECT } from "@/lib/db/metaCatalogFeed"
import type { MetaListingProductSource } from "@/lib/meta/catalog-product"
import { META_CATALOG_DAILY_ROTATION_DEFAULT_POOL_SIZE } from "@/lib/meta/daily-rotation-feed"

/**
 * Newest active, site-visible listings in one daily-rotation bucket.
 * Optional `userId` restricts the pool to Hayden’s shop (surfboards).
 */
export async function fetchMetaCatalogDailyRotationCandidates(
  supabase: SupabaseClient,
  options: {
    section: string
    userId?: string | null
    limit?: number
  },
): Promise<MetaListingProductSource[]> {
  const limit = Math.max(
    1,
    options.limit ?? META_CATALOG_DAILY_ROTATION_DEFAULT_POOL_SIZE,
  )

  if (options.userId !== undefined && !options.userId) {
    return []
  }

  let query = supabase
    .from("listings")
    .select(META_CATALOG_LISTING_SELECT)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .eq("section", options.section)

  if (options.userId) {
    query = query.eq("user_id", options.userId)
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return Array.isArray(data) ? (data as unknown as MetaListingProductSource[]) : []
}
