import type Stripe from "stripe"

/** Countries where Stripe Checkout can collect a shipping address (surf + common markets). */
export const STRIPE_CHECKOUT_SHIPPING_COUNTRIES: Stripe.Checkout.SessionCreateParams.ShippingAddressCollection.AllowedCountry[] =
  [
    "US",
    "CA",
    "AU",
    "NZ",
    "GB",
    "IE",
    "FR",
    "DE",
    "ES",
    "IT",
    "PT",
    "NL",
    "BE",
    "AT",
    "CH",
    "SE",
    "NO",
    "DK",
    "FI",
    "MX",
    "BR",
    "JP",
    "KR",
    "SG",
    "HK",
  ]

type ListingShipFlags = {
  local_pickup: boolean | null | undefined
  shipping_available: boolean | null | undefined
}

/**
 * True when this checkout should collect a shipping address in Stripe (buyer is having the item shipped).
 */
export function surfboardCheckoutCollectsShipping(
  listing: ListingShipFlags,
  fulfillment: string | null | undefined
): boolean {
  const lp = listing.local_pickup !== false
  const sa = !!listing.shipping_available
  const f =
    fulfillment === "shipping" ? "shipping" : fulfillment === "pickup" ? "pickup" : null

  if (!sa) return false
  if (!lp) return true
  return f === "shipping"
}

/** Normalized object for DB JSONB (purchases.shipping_address / orders.shipping_address). */
export function sessionToShippingAddressRecord(
  session: Stripe.Checkout.Session
): Record<string, unknown> | null {
  const ship = session.shipping_details
  const addr = ship?.address
  if (!addr?.line1?.trim()) {
    return null
  }

  return {
    name: ship.name ?? null,
    phone: ship.phone ?? session.customer_details?.phone ?? null,
    email: session.customer_details?.email ?? null,
    address: {
      line1: addr.line1,
      line2: addr.line2 ?? null,
      city: addr.city ?? null,
      state: addr.state ?? null,
      postal_code: addr.postal_code ?? null,
      country: addr.country ?? null,
    },
  }
}
