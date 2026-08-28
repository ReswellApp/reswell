import type { SupabaseClient } from "@supabase/supabase-js"
import {
  profileAddressesMatch,
  type ProfileAddressFieldsFromOrder,
  type ProfileAddressRow,
} from "@/lib/profile-address"

export type FetchProfileAddressesResult = {
  addresses: ProfileAddressRow[]
  error?: string
}

export async function fetchProfileAddresses(
  supabase: SupabaseClient,
  profileId: string,
): Promise<FetchProfileAddressesResult> {
  const { data, error } = await supabase
    .from("addresses")
    .select("*")
    .eq("profile_id", profileId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false })

  if (error) {
    return { addresses: [], error: error.message }
  }

  return { addresses: (data ?? []) as ProfileAddressRow[] }
}

export function findMatchingProfileAddress(
  addresses: ProfileAddressRow[],
  fields: ProfileAddressFieldsFromOrder,
): ProfileAddressRow | null {
  return addresses.find((row) => profileAddressesMatch(row, fields)) ?? null
}

export async function insertProfileAddress(
  supabase: SupabaseClient,
  profileId: string,
  fields: ProfileAddressFieldsFromOrder,
  opts?: { isDefault?: boolean; label?: string | null },
): Promise<{ address: ProfileAddressRow | null; error: string | null }> {
  const isDefault = opts?.isDefault === true

  if (isDefault) {
    await supabase.from("addresses").update({ is_default: false }).eq("profile_id", profileId)
  }

  const { data, error } = await supabase
    .from("addresses")
    .insert({
      profile_id: profileId,
      full_name: fields.full_name,
      phone: fields.phone,
      line1: fields.line1,
      line2: fields.line2,
      city: fields.city,
      state: fields.state,
      postal_code: fields.postal_code,
      country: fields.country,
      label: opts?.label?.trim() || null,
      is_default: isDefault,
    })
    .select()
    .single()

  if (error || !data) {
    return { address: null, error: error?.message ?? "Could not save address" }
  }

  return { address: data as ProfileAddressRow, error: null }
}

/** Recent confirmed shipping orders where this profile was the buyer. */
export async function fetchRecentBuyerShippingAddresses(
  supabase: SupabaseClient,
  buyerId: string,
  limit = 10,
): Promise<unknown[]> {
  const { data, error } = await supabase
    .from("orders")
    .select("shipping_address")
    .eq("buyer_id", buyerId)
    .eq("fulfillment_method", "shipping")
    .not("shipping_address", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data.map((row) => (row as { shipping_address: unknown }).shipping_address)
}
