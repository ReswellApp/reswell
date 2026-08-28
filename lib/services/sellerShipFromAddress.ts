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
 * Optionally fall back to another profile’s address (e.g. admin) for ops returns.
 */
export async function resolveSellerShipFromAddress(
  supabase: SupabaseClient,
  sellerId: string,
  sellerAddressId?: string | null,
  opts?: { fallbackProfileId?: string | null },
): Promise<
  | { ok: true; address: ProfileAddressRow; source: "seller" | "admin" }
  | { ok: false; error: string }
> {
  if (sellerAddressId?.trim()) {
    const id = sellerAddressId.trim()
    const { data, error } = await supabase
      .from("addresses")
      .select("*")
      .eq("id", id)
      .eq("profile_id", sellerId)
      .maybeSingle()
    if (!error && data) {
      return { ok: true, address: data as ProfileAddressRow, source: "seller" }
    }

    const fallbackId = opts?.fallbackProfileId?.trim()
    if (fallbackId) {
      const { data: adminAddr, error: adminErr } = await supabase
        .from("addresses")
        .select("*")
        .eq("id", id)
        .eq("profile_id", fallbackId)
        .maybeSingle()
      if (!adminErr && adminAddr) {
        return { ok: true, address: adminAddr as ProfileAddressRow, source: "admin" }
      }
    }

    return { ok: false, error: "Seller address not found." }
  }

  const { addresses } = await fetchProfileAddresses(supabase, sellerId)
  const preferred = addresses.find((r) => r.is_default) ?? addresses[0]
  if (preferred) {
    return { ok: true, address: preferred, source: "seller" }
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
      return { ok: true, address: recovered, source: "seller" }
    }
  }

  const fallbackId = opts?.fallbackProfileId?.trim()
  if (fallbackId) {
    const { addresses: adminAddresses } = await fetchProfileAddresses(supabase, fallbackId)
    const adminPreferred = adminAddresses.find((r) => r.is_default) ?? adminAddresses[0]
    if (adminPreferred) {
      return { ok: true, address: adminPreferred, source: "admin" }
    }
  }

  return {
    ok: false,
    error:
      "Seller has no ship-from address on file (and no past buyer shipping address to recover).",
  }
}
