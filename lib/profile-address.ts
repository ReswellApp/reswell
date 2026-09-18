/**
 * Saved addresses for a profile (buyer shipping, seller use cases, profile settings).
 * Backed by `public.addresses` (profile_id → profiles.id).
 */

export type AddressResidentialIndicator = "yes" | "no" | "unknown"

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
  residential?: AddressResidentialIndicator | null
  address_validated_at?: string | null
}

function parseStoredResidential(value: unknown): AddressResidentialIndicator | null {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (raw === "yes" || raw === "no" || raw === "unknown") return raw
  return null
}

/** Shape stored on orders.shipping_address (JSONB) for display and label purchase. */
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
      residential: parseStoredResidential(addr.residential) ?? "yes",
    },
  }
}

/** Fields needed to insert / match a row in `public.addresses`. */
export type ProfileAddressFieldsFromOrder = {
  full_name: string
  phone: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
  residential?: AddressResidentialIndicator | null
  address_validated_at?: string | null
}

/**
 * Parse `orders.shipping_address` JSON into profile address fields.
 * Returns null when street / city / postal are incomplete.
 */
export function parseOrderShippingAddressForProfile(
  ship: unknown,
): ProfileAddressFieldsFromOrder | null {
  const s =
    ship != null && typeof ship === "object" && !Array.isArray(ship)
      ? (ship as Record<string, unknown>)
      : null
  if (!s) return null
  const addrRaw = s.address
  const a =
    addrRaw != null && typeof addrRaw === "object" && !Array.isArray(addrRaw)
      ? (addrRaw as Record<string, unknown>)
      : null
  if (!a) return null

  const line1 = typeof a.line1 === "string" ? a.line1.trim() : ""
  const city = typeof a.city === "string" ? a.city.trim() : ""
  const postal_code = typeof a.postal_code === "string" ? a.postal_code.trim() : ""
  if (!line1 || !city || !postal_code) return null

  const full_name = typeof s.name === "string" ? s.name.trim() : ""
  const phoneRaw = typeof s.phone === "string" ? s.phone.trim() : ""
  const line2 = typeof a.line2 === "string" ? a.line2.trim() : ""
  const state = typeof a.state === "string" ? a.state.trim() : ""
  const countryRaw = typeof a.country === "string" ? a.country.trim() : ""

  return {
    full_name: full_name || "Member",
    phone: phoneRaw || null,
    line1,
    line2: line2 || null,
    city,
    state: state || null,
    postal_code,
    country: countryRaw || "US",
    residential: parseStoredResidential(a.residential),
  }
}

function normalizePostalForMatch(value: string): string {
  const compact = value.trim().toLowerCase().replace(/\s+/g, "")
  const digits = compact.replace(/\D/g, "")
  if (digits.length >= 5) return digits.slice(0, 5)
  return compact
}

export function profileAddressesMatch(
  a: Pick<ProfileAddressRow, "line1" | "city" | "postal_code">,
  b: Pick<ProfileAddressFieldsFromOrder, "line1" | "city" | "postal_code">,
): boolean {
  const norm = (v: string) => v.trim().toLowerCase().replace(/\s+/g, " ")
  return (
    norm(a.line1) === norm(b.line1) &&
    norm(a.city) === norm(b.city) &&
    normalizePostalForMatch(a.postal_code) === normalizePostalForMatch(b.postal_code)
  )
}
