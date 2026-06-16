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
  /** When `"reswell"`, checkout calls ShipEngine for live carrier rates. */
  board_shipping_cost_mode?: string | null
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
