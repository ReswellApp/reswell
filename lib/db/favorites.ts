import type { SupabaseClient } from "@supabase/supabase-js"

/** Listing fields needed for the cart page favorites carousel (surfboard tiles). */
export type CartCarouselFavoriteListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  section: string
  city: string | null
  state: string | null
  length_feet: number | null
  length_inches: number | null
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
        status,
        section,
        user_id,
        city,
        state,
        length_feet,
        length_inches,
        board_type,
        local_pickup,
        shipping_available,
        hidden_from_site,
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
          })
        | (CartCarouselFavoriteListing & {
            hidden_from_site?: boolean | null
          })[]
        | null
    }
    const Lraw = raw.listing
    const L = Array.isArray(Lraw) ? Lraw[0] : Lraw
    if (!L) continue
    if (L.hidden_from_site) continue
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
      status: L.status,
      section: L.section,
      city: L.city,
      state: L.state,
      length_feet: L.length_feet,
      length_inches: L.length_inches,
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
