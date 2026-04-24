import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Persists locality from the sell flow for autofill on later visits.
 * Stores city + state/region only (same as listing city/state), never street addresses.
 */
export async function updateProfileDefaultListingLocality(
  supabase: SupabaseClient,
  userId: string,
  input: { city: string; state: string | null },
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("profiles")
    .update({
      default_listing_city: input.city,
      default_listing_state: input.state,
    })
    .eq("id", userId)

  return { error: error?.message ?? null }
}
