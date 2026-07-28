import type { SupabaseClient } from "@supabase/supabase-js"
import { resolveAddressShippingIdentity } from "@/lib/db/addressShippingIdentity"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { toE164UsPhone } from "@/lib/utils/phone-e164-us"

export type EnsureCheckoutBuyerPhoneResult =
  | { ok: true; phone: string; address: ProfileAddressRow | null }
  | { ok: false; error: string }

/**
 * Requires a valid buyer phone on the profile (and syncs it onto the shipping
 * address row when payment is for shipping).
 */
export async function ensureCheckoutBuyerPhone(
  supabase: SupabaseClient,
  userId: string,
  buyerAddress: ProfileAddressRow | null,
): Promise<EnsureCheckoutBuyerPhoneResult> {
  const identity = await resolveAddressShippingIdentity(supabase, userId)
  const phone = identity.phone?.trim() || null
  if (!phone || !toE164UsPhone(phone)) {
    return {
      ok: false,
      error: "Phone number is required to complete checkout.",
    }
  }

  if (!buyerAddress) {
    return { ok: true, phone, address: null }
  }

  if (buyerAddress.phone?.trim() === phone) {
    return { ok: true, phone, address: buyerAddress }
  }

  const { data, error } = await supabase
    .from("addresses")
    .update({ phone })
    .eq("id", buyerAddress.id)
    .eq("profile_id", userId)
    .select()
    .maybeSingle()

  if (error || !data) {
    console.error("[checkoutBuyerPhone] address phone sync failed", error)
    return {
      ok: true,
      phone,
      address: { ...buyerAddress, phone },
    }
  }

  return { ok: true, phone, address: data as ProfileAddressRow }
}
