import { buyerMethodAllowed } from "@/lib/listing-fulfillment"

export type PayableListing = {
  price: string | number
  section: string
  shipping_available: boolean | null
  local_pickup: boolean | null
  shipping_price: string | number | null
}

export function resolvePayableAmount(
  listing: PayableListing,
  fulfillment?: string | null
): { ok: true; total: number; itemPrice: number; shipping: number } | { ok: false; error: string } {
  const itemPrice = parseFloat(String(listing.price))
  if (Number.isNaN(itemPrice) || itemPrice < 0) {
    return { ok: false, error: "Invalid listing price" }
  }

  if (listing.section !== "surfboards") {
    return { ok: true, total: itemPrice, itemPrice, shipping: 0 }
  }

  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  const shipRate = Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0)

  if (lp && !sa) {
    return { ok: true, total: itemPrice, itemPrice, shipping: 0 }
  }
  if (!lp && sa) {
    return { ok: true, total: itemPrice + shipRate, itemPrice, shipping: shipRate }
  }
  if (lp && sa) {
    const method =
      fulfillment === "shipping" ? "shipping" : fulfillment === "pickup" ? "pickup" : null
    if (!method) {
      return { ok: false, error: "Choose pickup or shipping for this listing" }
    }
    if (!buyerMethodAllowed(method, lp, sa)) {
      return { ok: false, error: "That fulfillment option is not available" }
    }
    const shipping = method === "shipping" ? shipRate : 0
    return { ok: true, total: itemPrice + shipping, itemPrice, shipping }
  }
  return { ok: false, error: "Listing has no valid fulfillment options" }
}
