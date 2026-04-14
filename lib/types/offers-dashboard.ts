export type DashboardListingEmbed = {
  id: string
  title: string | null
  slug: string | null
  section: string
  price: string | number
  status: string
  listing_images: {
    url: string
    is_primary: boolean | null
    thumbnail_url?: string | null
  }[] | null
}

export type DashboardProfileLite = {
  id: string
  display_name: string | null
  avatar_url: string | null
  shop_name: string | null
  is_shop: boolean | null
}

export type DashboardOfferRow = {
  id: string
  status: string
  current_amount: string | number
  initial_amount: string | number
  expires_at: string
  created_at: string
  updated_at: string
  counter_count: number
  listing_id: string
  buyer_id: string
  seller_id: string
  listings: DashboardListingEmbed | DashboardListingEmbed[] | null
  /** Latest seller counter note when status is COUNTERED (offers you made). */
  seller_counter_note?: string | null
}
