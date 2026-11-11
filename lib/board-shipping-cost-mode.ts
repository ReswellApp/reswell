import { listingAlwaysUsesReswellShipping } from "@/lib/apparel-listing-config"

export type BoardShippingCostModeListing = {
  section?: string | null
  board_shipping_cost_mode?: string | null
  shipping_price?: string | number | null
}

export function effectiveBoardShippingMode(
  listing: BoardShippingCostModeListing,
): "free" | "flat" | "reswell" {
  if (listingAlwaysUsesReswellShipping(listing.section)) return "reswell"
  const m = listing.board_shipping_cost_mode?.trim()
  if (m === "free" || m === "flat" || m === "reswell") return m
  const sp = Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0)
  return sp > 0 ? "flat" : "reswell"
}
