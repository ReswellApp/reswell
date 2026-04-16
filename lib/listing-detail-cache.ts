import { LISTING_SELLER_PROFILES_EMBED } from "@/lib/db/listing-seller-profile-embed"
import { createAnonSupabaseClient } from "@/lib/supabase/server"
import { findListingByParam } from "@/lib/listing-query"

export const LISTING_META_SELECT =
  "id, slug, title, description, status, price, listing_images (url, is_primary, sort_order), categories (name, slug), section, user_id, hidden_from_site"

export const LISTING_ROUTE_SHELL_SELECT = "id, section, slug, user_id, hidden_from_site"

const SURFBOARD_LISTING_SELECT = `
        *,
        listing_images (id, url, is_primary, sort_order),
        ${LISTING_SELLER_PROFILES_EMBED} (id, seller_slug, is_shop, shop_name, display_name, avatar_url, location, created_at, shop_verified, sales_count)
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

/** Public catalog rows only (anon, `hidden_from_site = false`). */
export async function getCachedPublicListingForMetadata(param: string) {
  const supabase = createAnonSupabaseClient()
  return findListingByParam(supabase, param, {
    select: LISTING_META_SELECT,
    section: undefined,
    includeHiddenListings: false,
  })
}

export async function getCachedPublicListingForRoute(param: string) {
  const supabase = createAnonSupabaseClient()
  return findListingByParam(supabase, param, {
    select: LISTING_ROUTE_SHELL_SELECT,
    section: undefined,
    includeHiddenListings: false,
  })
}

export async function getCachedPublicSurfboardListing(param: string) {
  const supabase = createAnonSupabaseClient()
  return findListingByParam(supabase, param, {
    select: SURFBOARD_LISTING_SELECT,
    section: "surfboards",
    includeHiddenListings: false,
  })
}

export { SURFBOARD_LISTING_SELECT }

export async function getCachedPublicShopListing(param: string) {
  const supabase = createAnonSupabaseClient()
  return findListingByParam(supabase, param, {
    select: SHOP_LISTING_SELECT,
    section: "new",
    includeHiddenListings: false,
  })
}

export { SHOP_LISTING_SELECT }

export async function getCachedShopRelatedListings(excludeListingId: string) {
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
}
