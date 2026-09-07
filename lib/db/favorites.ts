import type { SupabaseClient } from "@supabase/supabase-js"
import { isListingVisibleInSavedList } from "@/lib/listing-public-visibility"

/** Listing fields needed for the cart page favorites carousel (surfboard tiles). */
export type CartCarouselFavoriteListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | null
  status: string
  section: string
  city: string | null
  state: string | null
  dimensions: string | null
  board_type: string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  listing_images: { url: string; thumbnail_url?: string | null; is_primary?: boolean | null }[] | null
  categories: { name?: string | null } | null
  profiles: { display_name?: string | null; shop_verified?: boolean | null } | null
}

/**
 * Favorited surfboard listings for the cart carousel, newest first.
 * Omits listings already in `excludeListingIds` (e.g. current cart) and hidden listings.
 */
export async function getFavoriteListingsForCartCarousel(
  supabase: SupabaseClient,
  userId: string,
  options: { excludeListingIds?: string[] } = {},
): Promise<{ listings: CartCarouselFavoriteListing[]; error: string | null }> {
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      created_at,
      listing:listings (
        id,
        slug,
        title,
        price,
        compare_at_price,
        status,
        section,
        user_id,
        city,
        state,
        dimensions,
        board_type,
        local_pickup,
        shipping_available,
        hidden_from_site,
        archived_at,
        listing_images ( url, thumbnail_url, is_primary ),
        categories ( name ),
        profiles!listings_user_id_fkey ( display_name, shop_verified )
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(48)

  if (error) {
    return { listings: [], error: error.message }
  }

  const exclude = new Set(options.excludeListingIds ?? [])
  const listings: CartCarouselFavoriteListing[] = []

  for (const row of data ?? []) {
    const raw = row as {
      listing:
        | (CartCarouselFavoriteListing & {
            hidden_from_site?: boolean | null
            archived_at?: string | null
          })
        | (CartCarouselFavoriteListing & {
            hidden_from_site?: boolean | null
            archived_at?: string | null
          })[]
        | null
    }
    const Lraw = raw.listing
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L) continue
    if (!isListingVisibleInSavedList(L)) continue
    if (L.section !== "surfboards") continue
    if (exclude.has(L.id)) continue

    const cat = L.categories
    const categories = Array.isArray(cat) ? cat[0] ?? null : cat ?? null
    const pr = L.profiles as
      | { display_name?: string | null; shop_verified?: boolean | null }
      | { display_name?: string | null; shop_verified?: boolean | null }[]
      | null
      | undefined
    const profiles = Array.isArray(pr) ? pr[0] ?? null : pr ?? null

    listings.push({
      id: L.id,
      slug: L.slug,
      user_id: L.user_id,
      title: L.title,
      price: typeof L.price === "number" ? L.price : Number(L.price),
      compare_at_price:
        L.compare_at_price == null
          ? null
          : typeof L.compare_at_price === "number"
            ? L.compare_at_price
            : Number(L.compare_at_price),
      status: L.status,
      section: L.section,
      city: L.city,
      state: L.state,
      dimensions: L.dimensions,
      board_type: L.board_type,
      local_pickup: L.local_pickup,
      shipping_available: L.shipping_available,
      listing_images: L.listing_images,
      categories,
      profiles,
    })

    if (listings.length >= 24) break
  }

  return { listings, error: null }
}

/** Listing fields needed for the /favorites saved list. */
export type SavedFavoriteListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | string | null
  status: string
  section: string
  hidden_from_site?: boolean | null
  archived_at?: string | null
  city: string | null
  state: string | null
  condition?: string | null
  board_type?: string | null
  dimensions?: string | null
  shipping_available?: boolean | null
  local_pickup?: boolean | null
  listing_images: { url: string; is_primary: boolean }[]
  profiles?: { display_name?: string | null; shop_verified?: boolean } | null
  categories?: { name?: string | null } | null
}

export type SavedFavoriteRow = {
  id: string
  created_at: string
  listing: SavedFavoriteListing
}

/**
 * All saved listings for the signed-in user, newest first.
 * Visibility matches the public saved-list rules (active / pending / sold).
 */
export async function getSavedFavoritesForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ favorites: SavedFavoriteRow[]; error: string | null }> {
  const { data, error } = await supabase
    .from("favorites")
    .select(
      `
      id,
      created_at,
      listing:listings (
        id,
        slug,
        user_id,
        title,
        price,
        compare_at_price,
        status,
        section,
        hidden_from_site,
        archived_at,
        city,
        state,
        condition,
        board_type,
        dimensions,
        shipping_available,
        local_pickup,
        listing_images ( url, is_primary ),
        profiles!listings_user_id_fkey ( display_name, shop_verified ),
        categories ( name )
      )
    `,
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    return { favorites: [], error: error.message }
  }

  const favorites: SavedFavoriteRow[] = []

  for (const row of data ?? []) {
    const raw = row as {
      id: string
      created_at: string
      listing:
        | (SavedFavoriteListing & {
            listing_images?: { url: string; is_primary: boolean }[] | null
            profiles?:
              | { display_name?: string | null; shop_verified?: boolean }
              | { display_name?: string | null; shop_verified?: boolean }[]
              | null
            categories?:
              | { name?: string | null }
              | { name?: string | null }[]
              | null
          })
        | (SavedFavoriteListing & {
            listing_images?: { url: string; is_primary: boolean }[] | null
            profiles?:
              | { display_name?: string | null; shop_verified?: boolean }
              | { display_name?: string | null; shop_verified?: boolean }[]
              | null
            categories?:
              | { name?: string | null }
              | { name?: string | null }[]
              | null
          })[]
        | null
    }

    const listingRaw = raw.listing
    const listing = Array.isArray(listingRaw) ? listingRaw[0] : listingRaw
    if (!listing) continue
    if (!isListingVisibleInSavedList(listing)) continue

    const cat = listing.categories
    const categories = Array.isArray(cat) ? cat[0] ?? null : cat ?? null
    const pr = listing.profiles
    const profiles = Array.isArray(pr) ? pr[0] ?? null : pr ?? null

    favorites.push({
      id: raw.id,
      created_at: raw.created_at,
      listing: {
        ...listing,
        price: typeof listing.price === "number" ? listing.price : Number(listing.price),
        listing_images: listing.listing_images ?? [],
        categories,
        profiles,
      },
    })
  }

  return { favorites, error: null }
}
