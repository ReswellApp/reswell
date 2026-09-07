import type { ListingImageForCard } from "@/lib/listing-image-display"

/** Listing payload for blog embeds — same shape as homepage peer tiles. */
export type BlogEmbedListing = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number
  status: string
  section: string
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  listing_images?: ListingImageForCard[] | null
  categories?: { name?: string | null } | { name?: string | null }[] | null
  board_type?: string | null
  condition?: string | null
}
