import type { SupabaseClient } from "@supabase/supabase-js"

export interface StripePrefillProfileRow {
  seller_slug: string
  display_name: string | null
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
        .select("seller_slug, display_name")
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
    address: address as StripePrefillAddressRow | null,
  }
}
