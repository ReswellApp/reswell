import type { SupabaseClient } from "@supabase/supabase-js"
import { RESWELL_SHOP_SECTION } from "@/lib/reswell-shop"
import type { ListingImageForCard } from "@/lib/listing-image-display"

export type ReswellShopBrowseListing = {
  id: string
  slug: string | null
  title: string
  price: number
  compare_at_price?: number | null
  stock_quantity: number
  listing_images: ListingImageForCard[] | null
}

/**
 * Active Reswell shop inventory for `/reswell/shop` (in-stock first).
 */
export async function fetchReswellShopBrowseListings(
  supabase: SupabaseClient,
): Promise<ReswellShopBrowseListing[]> {
  const { data, error } = await supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      title,
      price,
      compare_at_price,
      stock_quantity,
      listing_images ( url, thumbnail_url, is_primary )
    `,
    )
    .eq("section", RESWELL_SHOP_SECTION)
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .is("archived_at", null)
    .gt("stock_quantity", 0)
    .order("created_at", { ascending: false })
    .limit(120)

  if (error || !data) {
    console.error("[reswell-shop-listings]", error?.message)
    return []
  }

  return data.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: String(row.title ?? ""),
    price: Number(row.price),
    compare_at_price:
      row.compare_at_price == null ? null : Number(row.compare_at_price),
    stock_quantity: Math.max(0, Math.floor(Number(row.stock_quantity) || 0)),
    listing_images: (row.listing_images as ListingImageForCard[] | null) ?? null,
  }))
}
