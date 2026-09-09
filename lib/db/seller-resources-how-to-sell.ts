import type { SupabaseClient } from "@supabase/supabase-js"
import type { ListingImageForCard } from "@/lib/listing-image-display"

export type HowToSellShopProfileRow = {
  id: string
  seller_slug: string | null
  display_name: string | null
  avatar_url: string | null
  city: string | null
  location: string | null
  is_shop: boolean | null
  shop_name: string | null
  shop_logo_url: string | null
  shop_verified: boolean | null
  shop_address: string | null
  sales_count: number | null
}

export type HowToSellSoldListingImageRow = {
  url: string | null
  thumbnail_url: string | null
  is_primary: boolean | null
  sort_order: number | null
}

export type HowToSellSoldListingRow = {
  id: string
  slug: string | null
  title: string
  condition: string | null
  primary_image_url: string | null
  primary_thumbnail_url: string | null
  listing_images: HowToSellSoldListingImageRow[] | null
}

const SHOP_PROFILE_SELECT =
  "id, seller_slug, display_name, avatar_url, city, location, is_shop, shop_name, shop_logo_url, shop_verified, shop_address, sales_count"

const SOLD_LISTING_SELECT = `
  id,
  slug,
  title,
  condition,
  primary_image_url,
  primary_thumbnail_url,
  listing_images ( url, thumbnail_url, is_primary, sort_order )
`

export async function listHowToSellShopProfiles(
  supabase: SupabaseClient,
  sellerIds: string[],
): Promise<HowToSellShopProfileRow[]> {
  if (sellerIds.length === 0) return []

  const { data, error } = await supabase
    .from("profiles")
    .select(SHOP_PROFILE_SELECT)
    .in("id", sellerIds)

  if (error) {
    console.error("[how-to-sell] shop profiles:", error.message)
    return []
  }

  return (data ?? []) as HowToSellShopProfileRow[]
}

export async function listHowToSellSoldSurfboardExamples(
  supabase: SupabaseClient,
  sellerId: string,
  limit = 16,
): Promise<HowToSellSoldListingRow[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(SOLD_LISTING_SELECT)
    .eq("user_id", sellerId)
    .eq("status", "sold")
    .eq("section", "surfboards")
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), 24))

  if (error) {
    console.error("[how-to-sell] sold photo examples:", error.message)
    return []
  }

  return (data ?? []) as HowToSellSoldListingRow[]
}

export function howToSellListingImagesForCard(
  images: HowToSellSoldListingRow["listing_images"],
): ListingImageForCard[] {
  if (!images?.length) return []
  return [...images]
    .sort((a, b) => {
      const ap = a.is_primary ? 1 : 0
      const bp = b.is_primary ? 1 : 0
      if (ap !== bp) return bp - ap
      return (a.sort_order ?? 999) - (b.sort_order ?? 999)
    })
    .map((img) => ({
      url: img.url,
      thumbnail_url: img.thumbnail_url,
      is_primary: img.is_primary,
    }))
}
