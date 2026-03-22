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

type LegacySessionShipping = {
  shipping_details?: {
    name?: string | null
    phone?: string | null
    address?: Stripe.Address | null
  } | null
}

function pickCheckoutShippingSource(session: Stripe.Checkout.Session): {
  name: string | null
  address: Stripe.Address
  /** Only set for legacy top-level shipping_details */
  legacyPhone: string | null
} | null {
  const collected = session.collected_information?.shipping_details
  if (collected?.address?.line1?.trim()) {
    const name =
      collected.name?.trim() ||
      session.collected_information?.individual_name?.trim() ||
      null
    return { name, address: collected.address, legacyPhone: null }
  }

  const legacy = (session as Stripe.Checkout.Session & LegacySessionShipping).shipping_details
  if (legacy?.address?.line1?.trim()) {
    return {
      name: legacy.name?.trim() || null,
      address: legacy.address,
      legacyPhone: legacy.phone?.trim() || null,
    }
  }

  const customer = session.customer_details
  if (customer?.address?.line1?.trim()) {
    return {
      name: customer.name?.trim() || null,
      address: customer.address,
      legacyPhone: null,
    }
  }

  return null
}

/** Normalized object for DB JSONB (purchases.shipping_address / orders.shipping_address). */
export function sessionToShippingAddressRecord(
  session: Stripe.Checkout.Session
): Record<string, unknown> | null {
  const picked = pickCheckoutShippingSource(session)
  if (!picked) {
    return null
  }

  const addr = picked.address
  const customer = session.customer_details

  return {
    name: picked.name,
    phone: customer?.phone ?? picked.legacyPhone ?? null,
    email: customer?.email ?? null,
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
