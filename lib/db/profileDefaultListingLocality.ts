import type { SupabaseClient } from "@supabase/supabase-js"

export type ProfileDefaultListingLocality = {
  city: string
  state: string | null
  lat: number | null
  lng: number | null
  display: string | null
}

/**
 * Persists listing locality from the sell flow for reuse on later visits.
 * Locality + optional map pin only — never street addresses.
 */
export async function updateProfileDefaultListingLocality(
  supabase: SupabaseClient,
  userId: string,
  input: {
    city: string
    state: string | null
    lat?: number | null
    lng?: number | null
    display?: string | null
  },
): Promise<{ error: string | null }> {
  const lat =
    input.lat != null && Number.isFinite(input.lat) && input.lat !== 0 ? input.lat : null
  const lng =
    input.lng != null && Number.isFinite(input.lng) && input.lng !== 0 ? input.lng : null
  const display = input.display?.trim() || null

  const { error } = await supabase
    .from("profiles")
    .update({
      default_listing_city: input.city,
      default_listing_state: input.state,
      default_listing_lat: lat,
      default_listing_lng: lng,
      default_listing_display: display,
    })
    .eq("id", userId)

  return { error: error?.message ?? null }
}

export async function fetchProfileDefaultListingLocality(
  supabase: SupabaseClient,
  userId: string,
): Promise<ProfileDefaultListingLocality | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "default_listing_city, default_listing_state, default_listing_lat, default_listing_lng, default_listing_display",
    )
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) return null

  const city = (data.default_listing_city ?? "").trim()
  if (!city) return null

  const stateRaw = (data.default_listing_state ?? "").trim()
  const lat =
    typeof data.default_listing_lat === "number" && Number.isFinite(data.default_listing_lat)
      ? data.default_listing_lat
      : null
  const lng =
    typeof data.default_listing_lng === "number" && Number.isFinite(data.default_listing_lng)
      ? data.default_listing_lng
      : null
  const display = (data.default_listing_display ?? "").trim() || null

  return {
    city,
    state: stateRaw || null,
    lat,
    lng,
    display,
  }
}
