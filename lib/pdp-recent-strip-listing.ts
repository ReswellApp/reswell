import type { ListingImageForCard } from "@/lib/listing-image-display"

/** Serializable surfboard row for PDP “recent” horizontal strips (client + API). */
export type PdpRecentStripListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  compare_at_price?: number | string | null
  condition: string | null
  board_type: string | null
  brand: string | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  section: string
  listing_images: ListingImageForCard[] | null
  categories: { name?: string | null } | null | { name?: string | null }[] | null
}

export function pdpRecentStripListingFromRow(row: Record<string, unknown>): PdpRecentStripListing {
  const priceRaw = row.price
  const price =
    typeof priceRaw === "number" && Number.isFinite(priceRaw)
      ? priceRaw
      : Number.parseFloat(String(priceRaw ?? 0)) || 0
  const cat = row.categories
  return {
    id: String(row.id ?? ""),
    slug: typeof row.slug === "string" ? row.slug : null,
    user_id: String(row.user_id ?? ""),
    title: typeof row.title === "string" ? row.title : "",
    price,
    compare_at_price: row.compare_at_price as number | string | null | undefined,
    condition: typeof row.condition === "string" ? row.condition : null,
    board_type: typeof row.board_type === "string" ? row.board_type : null,
    brand: typeof row.brand === "string" ? row.brand : null,
    shipping_available:
      row.shipping_available === null || row.shipping_available === undefined
        ? null
        : Boolean(row.shipping_available),
    local_pickup:
      row.local_pickup === null || row.local_pickup === undefined ? null : row.local_pickup !== false,
    section: typeof row.section === "string" ? row.section : "surfboards",
    listing_images: (row.listing_images as ListingImageForCard[] | null) ?? null,
    categories: (cat as PdpRecentStripListing["categories"]) ?? null,
  }
}

export type PdpRecentStripListingWithFavorite = PdpRecentStripListing & { viewerFavorited: boolean }
