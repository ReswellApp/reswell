import type { PayableListing } from "@/lib/purchase-amount"

/** Line-item labels for peer surfboard checkout (optional overrides). */
export type CheckoutCopy = {
  itemLineLabel: string
  inspectNoun: string
  /** e.g. "board" / "item" — used in "the ___ price only" */
  priceContextNoun: string
}

export type CheckoutListing = PayableListing & {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
  board_shipping_cost_mode?: string | null
  dimensions?: string | null
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  /** When false, hide Ship to me even if `shipping_available` is true (broken Reswell parcel). */
  shipping_quoteable?: boolean
  shipping_configured_but_broken?: boolean
  /** From /sell location step — Reswell shipping rates prefer this with map pin as fallback */
  city?: string | null
  state?: string | null
  listing_images?: Array<{
    url: string
    thumbnail_url?: string | null
    is_primary: boolean | null
  }> | null
}

export type CheckoutSeller = {
  display_name: string | null
  avatar_url: string | null
  seller_slug: string | null
  shop_name: string | null
  is_shop: boolean | null
}
