import { createAnonSupabaseClient } from "@/lib/supabase/anon"

export {
  LISTING_META_SELECT,
  LISTING_ROUTE_SHELL_SELECT,
  SHOP_LISTING_SELECT,
  SURFBOARD_LISTING_SELECT,
} from "@/lib/listing-detail-cache-selects"

export {
  getCachedPublicListingForMetadata,
  getCachedPublicListingForRoute,
  getCachedPublicShopListing,
  getCachedPublicSurfboardListing,
  LISTING_PUBLIC_DETAIL_REVALIDATE_SECONDS,
} from "@/lib/cache/listing-public-detail"

/** Public catalog rows only (anon, `hidden_from_site = false`). */
export async function getCachedShopRelatedListings(excludeListingId: string) {
  const supabase = createAnonSupabaseClient()
  const { data: relatedListings } = await supabase
    .from("listings")
    .select(`
      id,
      slug,
      title,
      price,
      listing_images (url, is_primary),
      stock_quantity,
      categories (name)
    `)
    .eq("section", "new")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .neq("id", excludeListingId)
    .order("created_at", { ascending: false })
    .limit(4)
  return relatedListings ?? []
}
