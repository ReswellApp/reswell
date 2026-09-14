import type { SupabaseClient } from "@supabase/supabase-js"

import { fetchDropoffLocationById, type DropoffLocationRow } from "@/lib/db/dropoff-locations"
import { resolveSellerShipFromAddress } from "@/lib/services/sellerShipFromAddress"
import type { ShipFromParts } from "@/lib/geocoding/nominatim-reverse-us-ship-from"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

export type DropoffShipFromSource = {
  dropoff_location_id?: string | null
  dropoff_locations?: DropoffLocationEmbed | DropoffLocationEmbed[] | null
}

export type DropoffLocationEmbed = {
  id?: string
  name?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  latitude?: number | string | null
  longitude?: number | string | null
}

export function embedFromDropoffLocation(row: DropoffLocationRow): DropoffLocationEmbed {
  return {
    id: row.id,
    name: row.name,
    address_line1: row.address_line1,
    address_line2: row.address_line2,
    city: row.city,
    state: row.state,
    postal_code: row.postal_code,
    latitude: row.latitude,
    longitude: row.longitude,
  }
}

export function firstDropoffLocationEmbed(
  listing: DropoffShipFromSource | null | undefined,
): DropoffLocationEmbed | null {
  if (!listing) return null
  const raw = listing.dropoff_locations
  const row = Array.isArray(raw) ? raw[0] : raw
  if (row && typeof row.city === "string" && row.city.trim()) return row
  return null
}

export function dropoffLocationToShipFromParts(loc: DropoffLocationEmbed): ShipFromParts | null {
  const city = loc.city?.trim() ?? ""
  const state = loc.state?.trim() ?? ""
  const postal = loc.postal_code?.trim() ?? ""
  if (!city || !state || postal.length < 5) return null
  return {
    address_line1: loc.address_line1?.trim() || "100 Main St",
    city_locality: city,
    state_province: state,
    postal_code: postal.slice(0, 5),
  }
}

export function dropoffLocationToRateQuoteAddress(
  loc: DropoffLocationEmbed,
): RateQuoteAddressFields | null {
  const parts = dropoffLocationToShipFromParts(loc)
  if (!parts) return null
  return {
    name: loc.name?.trim() || "Reswell",
    phone: "",
    company_name: "Reswell",
    address_line1: parts.address_line1,
    address_line2: loc.address_line2?.trim() ?? "",
    city_locality: parts.city_locality,
    state_province: parts.state_province,
    postal_code: parts.postal_code,
    country_code: "US",
    residential: "no",
  }
}

export function dropoffLocationToProfileAddressRow(
  loc: DropoffLocationEmbed,
  sellerId: string,
): ProfileAddressRow | null {
  const parts = dropoffLocationToShipFromParts(loc)
  if (!parts) return null
  const now = new Date().toISOString()
  return {
    id: loc.id?.trim() || "dropoff-location",
    profile_id: sellerId,
    full_name: loc.name?.trim() || "Reswell",
    phone: null,
    line1: parts.address_line1,
    line2: loc.address_line2?.trim() || null,
    city: parts.city_locality,
    state: parts.state_province,
    postal_code: parts.postal_code,
    country: "US",
    label: "Dropoff location",
    is_default: false,
    created_at: now,
    updated_at: now,
  }
}

export async function resolveDropoffLocationForListing(
  supabase: SupabaseClient,
  listing: DropoffShipFromSource | null | undefined,
): Promise<DropoffLocationEmbed | null> {
  const embedded = firstDropoffLocationEmbed(listing)
  if (embedded) return embedded
  const id = listing?.dropoff_location_id?.trim()
  if (!id) return null
  const row = await fetchDropoffLocationById(supabase, id)
  return row ? embedFromDropoffLocation(row) : null
}

export async function resolveSellerOrDropoffShipFrom(
  supabase: SupabaseClient,
  sellerId: string,
  listings: Array<DropoffShipFromSource | null | undefined>,
  sellerAddressId?: string | null,
): Promise<
  | { ok: true; address: ProfileAddressRow; source: "seller" | "admin" | "dropoff" }
  | { ok: false; error: string }
> {
  for (const listing of listings) {
    const loc = await resolveDropoffLocationForListing(supabase, listing)
    const address = loc ? dropoffLocationToProfileAddressRow(loc, sellerId) : null
    if (address) return { ok: true, address, source: "dropoff" }
  }
  const seller = await resolveSellerShipFromAddress(supabase, sellerId, sellerAddressId)
  if (!seller.ok) return seller
  return seller
}
