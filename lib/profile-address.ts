/**
 * Saved addresses for a profile (buyer shipping, seller use cases, profile settings).
 * Backed by `public.addresses` (profile_id → profiles.id).
 */

export type ProfileAddressRow = {
  id: string
  profile_id: string
  full_name: string
  phone: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
  label: string | null
  is_default: boolean
  created_at: string
  updated_at: string
}

/** Shape stored on orders.shipping_address (JSONB) for display. */
export function profileAddressToOrderShippingJson(addr: ProfileAddressRow, email: string | null) {
  return {
    name: addr.full_name,
    phone: addr.phone,
    email,
    address: {
      line1: addr.line1,
      line2: addr.line2,
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      country: addr.country,
    },
  }
}
