import type { SupabaseClient } from "@supabase/supabase-js"

import {
  findMatchingProfileAddress,
  insertProfileAddress,
} from "@/lib/db/profile-addresses"
import {
  googleAddressSnapshot,
  isMissingGoogleAddressColumn,
  withoutGoogleAddressColumns,
  type ProfileAddressFieldsFromOrder,
  type ProfileAddressRow,
} from "@/lib/profile-address"

export const SURFBOARD_SHIPPED_PICKUP_LABEL = "Surfboard Shipped pickup"

export type ListingSurfboardShippedRow = {
  id: string
  userId: string
  section: string
  optedIn: boolean
  pickupAddressId: string | null
}

const LISTING_SELECT =
  "id, user_id, section, surfboard_shipped, surfboard_shipped_pickup_address_id"

export async function fetchListingSurfboardShipped(
  supabase: SupabaseClient,
  listingId: string,
): Promise<{ row: ListingSurfboardShippedRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("listings")
    .select(LISTING_SELECT)
    .eq("id", listingId)
    .maybeSingle()

  if (error) return { row: null, error: error.message }
  if (!data) return { row: null, error: null }
  return { row: mapListing(asRecord(data)), error: null }
}

export async function setListingSurfboardShipped(
  supabase: SupabaseClient,
  listingId: string,
  input: { optedIn: boolean; pickupAddressId: string | null },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("listings")
    .update({
      surfboard_shipped: input.optedIn,
      surfboard_shipped_pickup_address_id: input.optedIn ? input.pickupAddressId : null,
    })
    .eq("id", listingId)

  return { error: error?.message ?? null }
}

export async function fetchProfileAddressById(
  supabase: SupabaseClient,
  profileId: string,
  addressId: string,
): Promise<ProfileAddressRow | null> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("id", addressId)
    .eq("profile_id", profileId)
    .maybeSingle()

  if (error || !data) return null
  return data as ProfileAddressRow
}

export async function saveSurfboardShippedPickupAddress(
  supabase: SupabaseClient,
  profileId: string,
  fields: ProfileAddressFieldsFromOrder,
  addressId: string | null,
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
    if (addressId) {
    const pin = googleAddressSnapshot(fields)
    const patch = {
      full_name: fields.full_name,
      phone: fields.phone,
      line1: fields.line1,
      line2: fields.line2,
      city: fields.city,
      state: fields.state,
      postal_code: fields.postal_code,
      country: fields.country,
      label: SURFBOARD_SHIPPED_PICKUP_LABEL,
      ...pin,
    }
    let { data, error } = await supabase
      .from("addresses")
      .update(patch)
      .eq("id", addressId)
      .eq("profile_id", profileId)
      .select("*")
      .maybeSingle()

    if (error && Object.keys(pin).length > 0 && isMissingGoogleAddressColumn(error.message)) {
      const retry = await supabase
        .from("addresses")
        .update(withoutGoogleAddressColumns(patch))
        .eq("id", addressId)
        .eq("profile_id", profileId)
        .select("*")
        .maybeSingle()
      data = retry.data
      error = retry.error
    }

    if (error || !data) {
      return { address: null, error: error?.message ?? "Pickup address was not found." }
    }
    return { address: data as ProfileAddressRow, error: null }
  }

  const { data: existingRows, error: listError } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", profileId)

  if (listError) return { address: null, error: listError.message }

  const existing = findMatchingProfileAddress((existingRows ?? []) as ProfileAddressRow[], fields)
  if (existing) {
    return saveSurfboardShippedPickupAddress(supabase, profileId, fields, existing.id)
  }

  return insertProfileAddress(supabase, profileId, fields, {
    isDefault: false,
    label: SURFBOARD_SHIPPED_PICKUP_LABEL,
  })
}

function mapListing(row: Record<string, unknown>): ListingSurfboardShippedRow {
  return {
    id: String(row.id ?? ""),
    userId: String(row.user_id ?? ""),
    section: String(row.section ?? ""),
    optedIn: row.surfboard_shipped === true,
    pickupAddressId:
      typeof row.surfboard_shipped_pickup_address_id === "string"
        ? row.surfboard_shipped_pickup_address_id
        : null,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value != null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {}
}
