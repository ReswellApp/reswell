import type { ListingImageForCard } from "@/lib/listing-image-display"

export type SellerOfferListing = {
  id: string
  title: string | null
  section: string | null
  price: number
  minimum_offer_pct: number | null
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: number | null
  board_shipping_cost_mode: "reswell" | "flat" | "free" | null
  listing_images: ListingImageForCard[] | null
}
