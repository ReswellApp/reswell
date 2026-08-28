import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchProfileAddresses,
  fetchRecentBuyerShippingAddresses,
  findMatchingProfileAddress,
  insertProfileAddress,
} from "@/lib/db/profile-addresses"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import {
  parseOrderShippingAddressForProfile,
  type ProfileAddressRow,
} from "@/lib/profile-address"

/**
 * Persist order shipping JSON onto the profile’s saved addresses when missing.
 * Used after buyer checkout and when recovering a seller ship-from from past purchases.
 */
export async function ensureProfileAddressFromOrderShipping(
  supabase: SupabaseClient,
  profileId: string,
  shippingJson: unknown,
  opts?: { makeDefaultIfEmpty?: boolean; label?: string | null },
): Promise<ProfileAddressRow | null> {
  const fields = parseOrderShippingAddressForProfile(shippingJson)
  if (!fields) return null

  const { addresses } = await fetchProfileAddresses(supabase, profileId)
  const existing = findMatchingProfileAddress(addresses, fields)
  if (existing) return existing

  const identity = await resolveAddressShippingIdentity(supabase, profileId, {
    full_name: fields.full_name,
    phone: fields.phone,
  })

  const makeDefault =
    opts?.makeDefaultIfEmpty !== false && addresses.length === 0

  const inserted = await insertProfileAddress(
    supabase,
    profileId,
    {
      ...fields,
      full_name: identity.full_name.trim() || fields.full_name,
      phone: identity.phone?.trim() || fields.phone,
    },
    {
      isDefault: makeDefault,
      label: opts?.label ?? null,
    },
  )

  return inserted.address
}

/**
 * Prefer an explicit / saved seller address. If none exist, recover from the most
 * recent shipping address on orders where this user was the buyer, and save it.
 */
export async function resolveSellerShipFromAddress(
  supabase: SupabaseClient,
  sellerId: string,
  sellerAddressId?: string | null,
): Promise<{ ok: true; address: ProfileAddressRow } | { ok: false; error: string }> {
  if (sellerAddressId?.trim()) {
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", sellerAddressId.trim())
      .eq("profile_id", sellerId)
      .maybeSingle()
    if (error || !data) {
      return { ok: false, error: "Seller address not found." }
    }
    return { ok: true, address: data as ProfileAddressRow }
  }

  const { addresses } = await fetchProfileAddresses(supabase, sellerId)
  const preferred = addresses.find((r) => r.is_default) ?? addresses[0]
  if (preferred) {
    return { ok: true, address: preferred }
  }

  const recentShipping = await fetchRecentBuyerShippingAddresses(supabase, sellerId)
  for (const shippingJson of recentShipping) {
    const recovered = await ensureProfileAddressFromOrderShipping(
      supabase,
      sellerId,
      shippingJson,
      { makeDefaultIfEmpty: true, label: "From past order" },
    )
    if (recovered) {
      return { ok: true, address: recovered }
    }
  }

  return { ok: false, error: "Seller has no ship-from address on file." }
}
