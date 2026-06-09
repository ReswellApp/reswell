import type { SupabaseClient } from "@supabase/supabase-js"
import type { ProfileAddressRow } from "@/lib/profile-address"

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
