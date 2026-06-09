import type { SupabaseClient } from "@supabase/supabase-js"

export type MyListingImageRow = {
  url: string
  thumbnail_url?: string | null
  is_primary: boolean | null
}

export type MyListingRow = {
  id: string
  slug: string | null
  title: string
  price: number
  status: string
  section: string
  views: number
  created_at: string
  archived_at: string | null
  listing_images: MyListingImageRow[] | null
}

export type FetchMyListingsResult = {
  listings: MyListingRow[]
  error?: string
}

const MY_LISTINGS_SELECT =
  "id, slug, title, price, status, section, views, created_at, archived_at, listing_images(url, thumbnail_url, is_primary)"

export async function fetchMyListings(
  supabase: SupabaseClient,
  userId: string,
): Promise<FetchMyListingsResult> {
  const { data, error } = await supabase
    .from("listings")
    .select(MY_LISTINGS_SELECT)
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })

  if (error) {
    return { listings: [], error: error.message }
  }

  return { listings: (data ?? []) as MyListingRow[] }
}
