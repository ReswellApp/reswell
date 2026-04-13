import { unstable_cache, revalidateTag } from "next/cache"
import { createAnonSupabaseClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"

/** Next.js Data Cache tag — invalidate when any listing detail payload may have changed. */
export const LISTING_DETAIL_CACHE_TAG = "listing-detail" as const

/** Next.js Data Cache — public listing detail payloads (~7 days, or on-demand via `revalidateListingDetailCache`). */
const REVALIDATE_SECONDS = 7 * 24 * 60 * 60

export const LISTING_META_SELECT =
  "id, slug, title, description, status, price, listing_images (url, is_primary, sort_order), categories (name, slug), section, user_id, hidden_from_site"

export const LISTING_ROUTE_SHELL_SELECT = "id, section, slug, user_id, hidden_from_site"

const SURFBOARD_LISTING_SELECT = `
        *,
        listing_images (id, url, is_primary, sort_order),
        profiles (id, seller_slug, is_shop, shop_name, display_name, avatar_url, location, created_at, shop_verified, sales_count)
      `

const SHOP_LISTING_SELECT = `
      id,
      title,
      description,
      price,
      status,
      user_id,
      listing_images (url, is_primary),
      inventory (quantity),
      categories (name)
    `

const getCachedPublicListingMetadataInner = unstable_cache(
  async (param: string) => {
    const supabase = createAnonSupabaseClient()
    return findListingByParam(supabase, param, {
      select: LISTING_META_SELECT,
      section: undefined,
      includeHiddenListings: false,
    })
  },
  ["listing-detail-metadata"],
  { revalidate: REVALIDATE_SECONDS, tags: [LISTING_DETAIL_CACHE_TAG] },
)

/** Public catalog rows only (anon, `hidden_from_site = false`). */
export function getCachedPublicListingForMetadata(param: string) {
  return getCachedPublicListingMetadataInner(param)
}

const getCachedPublicListingForRouteInner = unstable_cache(
  async (param: string) => {
    const supabase = createAnonSupabaseClient()
    return findListingByParam(supabase, param, {
      select: LISTING_ROUTE_SHELL_SELECT,
      section: undefined,
      includeHiddenListings: false,
    })
  },
  ["listing-detail-route-shell"],
  { revalidate: REVALIDATE_SECONDS, tags: [LISTING_DETAIL_CACHE_TAG] },
)

export function getCachedPublicListingForRoute(param: string) {
  return getCachedPublicListingForRouteInner(param)
}

const getCachedPublicSurfboardListingInner = unstable_cache(
  async (param: string) => {
    const supabase = createAnonSupabaseClient()
    return findListingByParam(supabase, param, {
      select: SURFBOARD_LISTING_SELECT,
      section: "surfboards",
      includeHiddenListings: false,
    })
  },
  ["listing-detail-surfboard"],
  { revalidate: REVALIDATE_SECONDS, tags: [LISTING_DETAIL_CACHE_TAG] },
)

export function getCachedPublicSurfboardListing(param: string) {
  return getCachedPublicSurfboardListingInner(param)
}

export { SURFBOARD_LISTING_SELECT }

const getCachedPublicShopListingInner = unstable_cache(
  async (param: string) => {
    const supabase = createAnonSupabaseClient()
    return findListingByParam(supabase, param, {
      select: SHOP_LISTING_SELECT,
      section: "new",
      includeHiddenListings: false,
    })
  },
  ["listing-detail-shop"],
  { revalidate: REVALIDATE_SECONDS, tags: [LISTING_DETAIL_CACHE_TAG] },
)

export function getCachedPublicShopListing(param: string) {
  return getCachedPublicShopListingInner(param)
}

export { SHOP_LISTING_SELECT }

const getCachedShopRelatedListingsInner = unstable_cache(
  async (excludeListingId: string) => {
    const supabase = createAnonSupabaseClient()
    const { data: relatedListings } = await supabase
      .from("listings")
      .select(`
      id,
      title,
      price,
      listing_images (url, is_primary),
      inventory (quantity),
      categories (name)
    `)
      .eq("section", "new")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .neq("id", excludeListingId)
      .order("created_at", { ascending: false })
      .limit(4)
    return relatedListings ?? []
  },
  ["listing-detail-shop-related"],
  { revalidate: REVALIDATE_SECONDS, tags: [LISTING_DETAIL_CACHE_TAG] },
)

export function getCachedShopRelatedListings(excludeListingId: string) {
  return getCachedShopRelatedListingsInner(excludeListingId)
}

/** Call after listing mutations that affect `/l/[slug]` HTML or metadata. */
export function revalidateListingDetailCache() {
  revalidateTag(LISTING_DETAIL_CACHE_TAG, "max")
}
