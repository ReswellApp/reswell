import type { SupabaseClient } from "@supabase/supabase-js"

import {
  parseDropoffBoxRules,
  type DropoffBoxRule,
} from "@/lib/dropoff-location-box-rules"

export type DropoffLocationRow = {
  id: string
  slug: string
  name: string
  address_line1: string
  address_line2: string | null
  city: string
  state: string
  postal_code: string
  country: string
  latitude: number | null
  longitude: number | null
  phone: string | null
  hours_note: string | null
  box_rules: DropoffBoxRule[]
  active: boolean
  sort_order: number
}

export type DropoffLocationListingRow = {
  id: string
  slug: string | null
  title: string | null
  status: string | null
  user_id: string
  city: string | null
  state: string | null
  dimensions: string | null
  dropoff_location_id: string
  shipping_packed_length_in: number | string | null
  shipping_packed_width_in: number | string | null
  shipping_packed_height_in: number | string | null
  shipping_packed_weight_oz: number | string | null
  created_at: string
  listing_images:
    | { url: string | null; thumbnail_url: string | null; is_primary: boolean | null }[]
    | null
}

const LOCATION_SELECT = `
  id,
  slug,
  name,
  address_line1,
  address_line2,
  city,
  state,
  postal_code,
  country,
  latitude,
  longitude,
  phone,
  hours_note,
  box_rules,
  active,
  sort_order
`.trim()

const LISTING_SELECT = `
  id,
  slug,
  title,
  status,
  user_id,
  city,
  state,
  dimensions,
  dropoff_location_id,
  shipping_packed_length_in,
  shipping_packed_width_in,
  shipping_packed_height_in,
  shipping_packed_weight_oz,
  created_at,
  listing_images ( url, thumbnail_url, is_primary )
`.trim()

function mapLocation(row: Record<string, unknown>): DropoffLocationRow {
  return {
    id: String(row.id),
    slug: String(row.slug ?? ""),
    name: String(row.name ?? ""),
    address_line1: String(row.address_line1 ?? ""),
    address_line2: typeof row.address_line2 === "string" ? row.address_line2 : null,
    city: String(row.city ?? ""),
    state: String(row.state ?? ""),
    postal_code: String(row.postal_code ?? ""),
    country: String(row.country ?? "US"),
    latitude: typeof row.latitude === "number" ? row.latitude : row.latitude != null ? Number(row.latitude) : null,
    longitude:
      typeof row.longitude === "number" ? row.longitude : row.longitude != null ? Number(row.longitude) : null,
    phone: typeof row.phone === "string" ? row.phone : null,
    hours_note: typeof row.hours_note === "string" ? row.hours_note : null,
    box_rules: parseDropoffBoxRules(row.box_rules),
    active: row.active === true,
    sort_order: typeof row.sort_order === "number" ? row.sort_order : 0,
  }
}

export async function listActiveDropoffLocations(
  supabase: SupabaseClient,
): Promise<DropoffLocationRow[]> {
  const { data, error } = await supabase
    .from("dropoff_locations")
    .select(LOCATION_SELECT)
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => mapLocation(row as Record<string, unknown>))
}

export async function listAllDropoffLocations(
  supabase: SupabaseClient,
): Promise<DropoffLocationRow[]> {
  const { data, error } = await supabase
    .from("dropoff_locations")
    .select(LOCATION_SELECT)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row) => mapLocation(row as Record<string, unknown>))
}

export async function fetchDropoffLocationById(
  supabase: SupabaseClient,
  id: string,
): Promise<DropoffLocationRow | null> {
  const trimmed = id.trim()
  if (!trimmed) return null
  const { data, error } = await supabase
    .from("dropoff_locations")
    .select(LOCATION_SELECT)
    .eq("id", trimmed)
    .maybeSingle()

  if (error || !data) return null
  return mapLocation(data as Record<string, unknown>)
}

export async function updateDropoffLocationRow(
  supabase: SupabaseClient,
  id: string,
  patch: {
    name: string
    address_line1: string
    address_line2: string | null
    city: string
    state: string
    postal_code: string
    phone: string | null
    hours_note: string | null
    latitude: number | null
    longitude: number | null
    active: boolean
    box_rules: DropoffBoxRule[]
  },
): Promise<DropoffLocationRow> {
  const { data, error } = await supabase
    .from("dropoff_locations")
    .update({
      name: patch.name,
      address_line1: patch.address_line1,
      address_line2: patch.address_line2,
      city: patch.city,
      state: patch.state,
      postal_code: patch.postal_code,
      phone: patch.phone,
      hours_note: patch.hours_note,
      latitude: patch.latitude,
      longitude: patch.longitude,
      active: patch.active,
      box_rules: patch.box_rules,
    })
    .eq("id", id)
    .select(LOCATION_SELECT)
    .single()

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update dropoff location.")
  }
  return mapLocation(data as Record<string, unknown>)
}

export async function listDropoffLocationListings(
  supabase: SupabaseClient,
  locationId?: string | null,
): Promise<DropoffLocationListingRow[]> {
  let query = supabase
    .from("listings")
    .select(LISTING_SELECT)
    .not("dropoff_location_id", "is", null)
    .is("archived_at", null)
    .neq("status", "removed")
    .order("created_at", { ascending: false })
    .limit(200)

  if (locationId?.trim()) {
    query = query.eq("dropoff_location_id", locationId.trim())
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as DropoffLocationListingRow[]
}

export async function updateDropoffListingPackedParcel(
  supabase: SupabaseClient,
  listingId: string,
  parcel: {
    shipping_packed_length_in: number
    shipping_packed_width_in: number
    shipping_packed_height_in: number
    shipping_packed_weight_oz: number
  },
): Promise<void> {
  const { data, error } = await supabase
    .from("listings")
    .update(parcel)
    .eq("id", listingId)
    .not("dropoff_location_id", "is", null)
    .select("id")
    .maybeSingle()

  if (error) throw error
  if (!data?.id) {
    throw new Error("Listing is not using a dropoff location.")
  }
}
