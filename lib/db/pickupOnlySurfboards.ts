import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingImageForCard } from "@/lib/listing-image-display"

const PAGE_SIZE = 1000

const PICKUP_ONLY_SURFBOARD_SELECT = `
  id,
  slug,
  title,
  price,
  brand,
  model,
  condition,
  board_type,
  dimensions,
  views,
  created_at,
  city,
  state,
  latitude,
  longitude,
  local_pickup,
  shipping_available,
  listing_images ( url, thumbnail_url, is_primary )
`.trim()

export type PickupOnlySurfboardDbRow = {
  id: string
  slug: string | null
  title: string
  price: number | string
  brand: string | null
  model: string | null
  condition: string | null
  board_type: string | null
  dimensions: string | null
  views: number | null
  created_at: string
  city: string | null
  state: string | null
  latitude: number | string | null
  longitude: number | string | null
  local_pickup: boolean | null
  shipping_available: boolean | null
  listing_images: ListingImageForCard[] | null
}

/**
 * Active, site-visible surfboards that offer local pickup and do not ship.
 * Paged to stay under PostgREST’s default row cap.
 */
export async function listPickupOnlySurfboards(
  supabase: SupabaseClient,
): Promise<PickupOnlySurfboardDbRow[]> {
  const rows: PickupOnlySurfboardDbRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("listings")
      .select(PICKUP_ONLY_SURFBOARD_SELECT)
      .eq("section", "surfboards")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .is("archived_at", null)
      .or("local_pickup.eq.true,local_pickup.is.null")
      .or("shipping_available.eq.false,shipping_available.is.null")
      .order("created_at", { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (error) {
      console.error("[listPickupOnlySurfboards]", error.message)
      throw new Error("Could not load pickup-only surfboards")
    }

    const page = (data ?? []) as unknown as PickupOnlySurfboardDbRow[]
    rows.push(...page)
    if (page.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  return rows
}
