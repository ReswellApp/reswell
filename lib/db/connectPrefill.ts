import type { SupabaseClient } from "@supabase/supabase-js"
import { formatProfileLegalName } from "@/lib/utils/profile-personal-info"

export interface StripePrefillProfileRow {
  seller_slug: string
  display_name: string | null
  first_name: string | null
  last_name: string | null
  phone: string | null
}

export interface StripePrefillAddressRow {
  full_name: string
  phone: string | null
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
}

/**
 * Loads profile + best default address for Stripe Connect prefill (Express onboarding).
 */
export async function getStripeConnectPrefillData(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  profile: StripePrefillProfileRow | null
  address: StripePrefillAddressRow | null
}> {
  const [{ data: profile, error: profileErr }, { data: address, error: addrErr }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("seller_slug, display_name, first_name, last_name, phone")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("addresses")
        .select("full_name, phone, line1, line2, city, state, postal_code, country")
        .eq("profile_id", userId)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle(),
    ])

  if (profileErr) {
    console.error("[connect prefill db] profiles", profileErr)
  }
  if (addrErr) {
    console.error("[connect prefill db] addresses", addrErr)
  }

  return {
    profile: profile as StripePrefillProfileRow | null,
    address: address
      ? ({
          ...address,
          full_name:
            formatProfileLegalName(
              (profile as StripePrefillProfileRow | null)?.first_name,
              (profile as StripePrefillProfileRow | null)?.last_name,
              (profile as StripePrefillProfileRow | null)?.display_name,
            ) || address.full_name,
          phone:
            (profile as StripePrefillProfileRow | null)?.phone?.trim() ||
            address.phone,
        } as StripePrefillAddressRow)
      : null,
  }
}
