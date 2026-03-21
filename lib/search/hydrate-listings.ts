import type { SupabaseClient } from "@supabase/supabase-js"
import type { RecentListing } from "@/app/used/recent/recent-feed-client"

const SELECT = `
  id,
  user_id,
  title,
  price,
  condition,
  section,
  city,
  state,
  shipping_available,
  board_type,
  length_feet,
  length_inches,
  listing_images (url, is_primary),
  profiles (display_name, avatar_url, location, sales_count),
  categories (name, slug)
`

/** Fetch full listing rows for cards, preserving `ids` order. */
export async function hydrateListingsByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<RecentListing[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(SELECT)
    .in("id", ids)
    .eq("status", "active")

  if (error || !data) return []

  const map = new Map(
    (data as any[]).map((row) => [row.id as string, row] as const),
  )

  const out: RecentListing[] = []
  for (const id of ids) {
    const row = map.get(id)
    if (!row) continue
    const boardLength =
      row.length_feet != null && row.length_inches != null
        ? `${row.length_feet}'${row.length_inches}"`
        : row.length_feet != null
          ? `${row.length_feet}'`
          : null
    out.push({
      id: row.id,
      user_id: row.user_id,
      title: row.title,
      price: row.price,
      condition: row.condition,
      section: row.section,
      city: row.city,
      state: row.state,
      shipping_available: row.shipping_available,
      board_type: row.board_type,
      board_length: boardLength,
      listing_images: row.listing_images,
      profiles: row.profiles,
      categories: row.categories,
    })
  }
  return out
}
